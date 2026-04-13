import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createSSEStream } from "@/lib/agent/stream-encoder";
import type { TokenUsage } from "@/lib/agent/event-types";
import { DEFAULT_BASE_URL } from "@/lib/constants";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";
import { prepareSessionRuntimeSkill } from "@/lib/server/skill-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AgentRequestSchema = z.object({
  sessionId: z.string().cuid(),
  message: z.string().trim().min(1).max(200_000),
  modelConfig: z.object({
    model: z.string().trim().min(1).max(120),
    apiKey: z.string().trim().min(1),
    baseURL: z.string().trim().url().optional(),
  }),
});

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    return toRecord(JSON.parse(trimmed));
  } catch {
    return { _raw: raw };
  }
}

interface ParsedToolResult {
  toolUseId: string;
  result: string;
  isError: boolean;
}

function stringifyToolResultContent(content: unknown): string {
  if (content === undefined || content === null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      if (block.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      }
    }
    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return stringifyUnknown(content);
}

function pushUniqueToolResult(
  results: ParsedToolResult[],
  seen: Set<string>,
  value: ParsedToolResult
): void {
  const key = `${value.toolUseId}\u0000${value.isError ? "1" : "0"}\u0000${value.result}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  results.push(value);
}

function extractUsage(sdkMessage: SDKMessage): TokenUsage | undefined {
  if (sdkMessage.type !== "result") {
    return undefined;
  }

  const usage = sdkMessage.usage;
  const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function extractToolResults(sdkMessage: SDKMessage): ParsedToolResult[] {
  if (sdkMessage.type !== "user") {
    return [];
  }

  const results: ParsedToolResult[] = [];
  const seen = new Set<string>();

  if (sdkMessage.parent_tool_use_id && sdkMessage.tool_use_result !== undefined) {
    const rawResult = sdkMessage.tool_use_result;
    const isError =
      typeof rawResult === "object" &&
      rawResult !== null &&
      "is_error" in rawResult &&
      (rawResult as { is_error?: unknown }).is_error === true;
    const resultContent =
      typeof rawResult === "object" &&
      rawResult !== null &&
      "content" in rawResult
        ? (rawResult as { content?: unknown }).content
        : rawResult;

    pushUniqueToolResult(results, seen, {
      toolUseId: sdkMessage.parent_tool_use_id,
      result: stringifyToolResultContent(resultContent),
      isError,
    });
  }

  const contentBlocks = Array.isArray(sdkMessage.message.content) ? sdkMessage.message.content : [];
  for (const block of contentBlocks) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as unknown as Record<string, unknown>;
    if (record.type !== "tool_result") {
      continue;
    }
    if (typeof record.tool_use_id !== "string") {
      continue;
    }

    pushUniqueToolResult(results, seen, {
      toolUseId: record.tool_use_id,
      result: stringifyToolResultContent(record.content),
      isError: record.is_error === true,
    });
  }

  return results;
}

function buildPromptFromHistory(
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  incomingMessage: string
): string {
  const historyText = history
    .map((item) => {
      const roleLabel =
        item.role === "user" ? "User" : item.role === "assistant" ? "Assistant" : "System";
      return `${roleLabel}: ${item.content}`;
    })
    .join("\n\n");

  return `Conversation History:\n${historyText}\n\n---\n\nUser Request:\n${incomingMessage}`;
}

function buildSkillSystemPromptAppend(skill: {
  name: string;
  description: string | null;
  contentMarkdown: string;
}): string {
  return [
    "You are running in a strictly isolated single-skill session.",
    `Active skill name: ${skill.name}`,
    skill.description ? `Active skill description: ${skill.description}` : null,
    "Do not introduce yourself unless the user explicitly asks who you are.",
    "Any first-person statements inside the skill content define the assistant persona, not the user identity.",
    "Never infer or claim the user's name or identity from skill content alone.",
    "You may reference the user's name only if the user explicitly states it in this conversation.",
    "If asked for the user's name without explicit in-conversation evidence, say you don't know and ask the user to provide it.",
    "For identity questions (e.g., 'who are you'), answer as the active skill persona defined in the Active Skill Specification.",
    "Do not identify yourself as Claude Code, Anthropic CLI, or any platform/tool by default.",
    "Never output boilerplate introductions like 'I am Claude Code...' unless the user explicitly asks about runtime or platform details.",
    "You must only use the active skill specification below.",
    "Do not rely on any external or unrelated skill definitions.",
    "",
    "## Active Skill Specification",
    skill.contentMarkdown,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  let parsedBody: z.infer<typeof AgentRequestSchema>;

  try {
    const body = await request.json();
    const parsed = AgentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    parsedBody = parsed.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let userId: string;
  try {
    const user = await getOrCreateUserFromRequest(request);
    userId = user.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await prisma.session.findFirst({
    where: {
      id: parsedBody.sessionId,
      userId,
    },
    include: {
      skill: {
        select: {
          id: true,
          name: true,
          description: true,
          contentMarkdown: true,
          icon: true,
          status: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          content: true,
        },
      },
    },
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (session.skill.status !== "published") {
    return new Response(
      JSON.stringify({ error: "该 skill 已下架/删除，无法继续会话" }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await prisma.message.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: parsedBody.message,
    },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: {
      title:
        session.messages.length === 0
          ? parsedBody.message.slice(0, 48)
          : undefined,
    },
  });

  const { stream, writer } = createSSEStream();
  const turnId = generateId();

  (async () => {
    let completed = false;
    let sawPartialMessages = false;
    let assistantContent = "";
    const toolMetaByIndex = new Map<number, { id: string; name: string }>();
    const partialToolInputByIndex = new Map<number, string>();
    const startedToolUseIds = new Set<string>();
    const toolCallsForStorage = new Map<
      string,
      { id: string; name: string; input: Record<string, unknown>; status: "running" | "completed" | "error"; result?: string }
    >();

    try {
      const runtime = await prepareSessionRuntimeSkill(session.id, {
        name: session.skill.name,
        description: session.skill.description,
        contentMarkdown: session.skill.contentMarkdown,
        icon: session.skill.icon,
      });

      const prompt = buildPromptFromHistory(session.messages, parsedBody.message);
      const skillSystemPrompt = buildSkillSystemPromptAppend({
        name: session.skill.name,
        description: session.skill.description,
        contentMarkdown: session.skill.contentMarkdown,
      });

      const sdkQuery = query({
        prompt,
        options: {
          cwd: runtime.cwd,
          model: parsedBody.modelConfig.model,
          // Load only project-level settings/skills from the isolated runtime cwd:
          // .runtime/sessions/<sessionId>/.claude/skills/active/SKILL.md
          settingSources: ["project"],
          // Use a fully custom system prompt to avoid preset identity bias
          // (e.g. "I am Claude Code...").
          systemPrompt: skillSystemPrompt,
          allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "LS", "Bash", "Skill"],
          permissionMode: "dontAsk",
          includePartialMessages: true,
          plugins: [],
          settings: {
            enabledPlugins: {},
          },
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: parsedBody.modelConfig.apiKey,
            ANTHROPIC_BASE_URL: parsedBody.modelConfig.baseURL || DEFAULT_BASE_URL,
          },
        },
      });

      for await (const sdkMessage of sdkQuery) {
        if (sdkMessage.type === "stream_event") {
          sawPartialMessages = true;
          const event = sdkMessage.event;

          if (event.type === "content_block_start") {
            const contentBlock = event.content_block;
            if (contentBlock.type === "tool_use") {
              toolMetaByIndex.set(event.index, {
                id: contentBlock.id,
                name: contentBlock.name,
              });

              const input = toRecord(contentBlock.input);
              const existing = toolCallsForStorage.get(contentBlock.id);

              if (!startedToolUseIds.has(contentBlock.id)) {
                writer.write({
                  type: "tool_start",
                  toolUseId: contentBlock.id,
                  toolName: contentBlock.name,
                  toolInput: input,
                  timestamp: Date.now(),
                });
                startedToolUseIds.add(contentBlock.id);
              }

              toolCallsForStorage.set(contentBlock.id, {
                id: contentBlock.id,
                name: contentBlock.name,
                input,
                status: existing?.status ?? "running",
                result: existing?.result,
              });
            }
          } else if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta" && delta.text) {
              assistantContent += delta.text;
              writer.write({
                type: "text_delta",
                delta: delta.text,
                turnId,
                timestamp: Date.now(),
              });
            } else if (delta.type === "input_json_delta") {
              const previous = partialToolInputByIndex.get(event.index) ?? "";
              partialToolInputByIndex.set(event.index, previous + delta.partial_json);
            }
          } else if (event.type === "content_block_stop") {
            const toolMeta = toolMetaByIndex.get(event.index);
            const partialInput = partialToolInputByIndex.get(event.index);
            if (toolMeta && partialInput) {
              const input = parseJsonRecord(partialInput);
              const existing = toolCallsForStorage.get(toolMeta.id);
              toolCallsForStorage.set(toolMeta.id, {
                id: toolMeta.id,
                name: toolMeta.name,
                input,
                status: existing?.status ?? "running",
                result: existing?.result,
              });
            }

            toolMetaByIndex.delete(event.index);
            partialToolInputByIndex.delete(event.index);
          }

          continue;
        }

        if (sdkMessage.type === "assistant") {
          if (!sawPartialMessages) {
            const textParts: string[] = [];
            for (const block of sdkMessage.message.content) {
              if (block.type === "text") {
                textParts.push(block.text);
              }
            }
            const text = textParts.join("");
            if (text) {
              assistantContent += text;
              writer.write({
                type: "text_delta",
                delta: text,
                turnId,
                timestamp: Date.now(),
              });
            }
          }
          continue;
        }

        if (sdkMessage.type === "tool_progress") {
          // Ignore nested tool progress (e.g. Read inside Task) to avoid
          // creating orphan running states without matching tool_result.
          if (sdkMessage.parent_tool_use_id !== null) {
            continue;
          }

          if (!startedToolUseIds.has(sdkMessage.tool_use_id)) {
            writer.write({
              type: "tool_start",
              toolUseId: sdkMessage.tool_use_id,
              toolName: sdkMessage.tool_name,
              toolInput: {},
              timestamp: Date.now(),
            });
            startedToolUseIds.add(sdkMessage.tool_use_id);
            toolCallsForStorage.set(sdkMessage.tool_use_id, {
              id: sdkMessage.tool_use_id,
              name: sdkMessage.tool_name,
              input: {},
              status: "running",
            });
          }
          continue;
        }

        const toolResults = extractToolResults(sdkMessage);
        if (toolResults.length > 0) {
          for (const toolResult of toolResults) {
            writer.write({
              type: "tool_result",
              toolUseId: toolResult.toolUseId,
              result: toolResult.result,
              isError: toolResult.isError,
              timestamp: Date.now(),
            });

            const existing = toolCallsForStorage.get(toolResult.toolUseId);
            if (existing) {
              toolCallsForStorage.set(toolResult.toolUseId, {
                ...existing,
                status: toolResult.isError ? "error" : "completed",
                result: toolResult.result,
              });
            } else {
              toolCallsForStorage.set(toolResult.toolUseId, {
                id: toolResult.toolUseId,
                name: "Tool",
                input: {},
                status: toolResult.isError ? "error" : "completed",
                result: toolResult.result,
              });
            }
          }
          continue;
        }

        if (sdkMessage.type === "result") {
          writer.write({
            type: "text_complete",
            turnId,
            timestamp: Date.now(),
          });

          writer.write({
            type: "complete",
            usage: extractUsage(sdkMessage),
            timestamp: Date.now(),
          });

          completed = true;
        }
      }

      if (!completed) {
        writer.write({ type: "text_complete", turnId, timestamp: Date.now() });
        writer.write({ type: "complete", timestamp: Date.now() });
      }

      for (const [toolUseId, value] of toolCallsForStorage.entries()) {
        if (value.status === "running") {
          toolCallsForStorage.set(toolUseId, {
            ...value,
            status: "completed",
          });
        }
      }

      await prisma.message.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: assistantContent,
          toolCallsJson: Array.from(toolCallsForStorage.values()) as unknown as Prisma.InputJsonValue,
        },
      });
      await prisma.session.update({
        where: { id: session.id },
        data: {
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      writer.write({
        type: "error",
        error: message,
        timestamp: Date.now(),
      });
    } finally {
      writer.close();
    }
  })().catch(() => {
    // Inner try/catch/finally already reports and closes the stream.
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
