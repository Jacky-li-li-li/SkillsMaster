import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { createSSEStream } from "@/lib/agent/stream-encoder";
import type { TokenUsage } from "@/lib/agent/event-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface FileContent {
  name: string;
  content: string;
}

interface ChatRequest {
  message: string;
  history?: HistoryMessage[];
  files?: FileContent[];
  apiKey: string;
  baseURL?: string;
  model?: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function buildPrompt(
  message: string,
  history?: HistoryMessage[],
  files?: FileContent[]
): string {
  const sections: string[] = [];

  if (history?.length) {
    const historyText = history
      .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`)
      .join("\n\n");
    sections.push(`Conversation History:\n${historyText}`);
  }

  if (files?.length) {
    const filesText = files
      .map((file) => `File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\``)
      .join("\n\n");
    sections.push(`User Files:\n${filesText}`);
  }

  sections.push(`User Request:\n${message}`);
  return sections.join("\n\n---\n\n");
}

function extractAssistantText(sdkMessage: SDKMessage): string {
  if (sdkMessage.type !== "assistant") {
    return "";
  }

  const contentBlocks = sdkMessage.message.content;
  if (!Array.isArray(contentBlocks)) {
    return "";
  }

  const textParts: string[] = [];
  for (const block of contentBlocks) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "text"
    ) {
      const maybeText = (block as { text?: unknown }).text;
      if (typeof maybeText === "string") {
        textParts.push(maybeText);
      }
    }
  }

  return textParts.join("");
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

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseToolInput(partialJson: string): Record<string, unknown> {
  const trimmed = partialJson.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return toRecord(JSON.parse(trimmed));
  } catch {
    return { _raw: partialJson };
  }
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

function extractToolResult(
  sdkMessage: SDKMessage
): { toolUseId: string; result: string; isError: boolean } | null {
  if (
    sdkMessage.type !== "user" ||
    !sdkMessage.parent_tool_use_id ||
    sdkMessage.tool_use_result === undefined
  ) {
    return null;
  }

  const toolResult = sdkMessage.tool_use_result;
  const isError =
    typeof toolResult === "object" &&
    toolResult !== null &&
    "is_error" in toolResult &&
    (toolResult as { is_error?: unknown }).is_error === true;

  return {
    toolUseId: sdkMessage.parent_tool_use_id,
    result: stringifyUnknown(toolResult),
    isError,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;

  if (!body.message || !body.apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing message or apiKey" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { stream, writer } = createSSEStream();
  const turnId = generateId();

  const settingSources = ["user", "project"] as const;
  const allowedTools = [
    "Skill",
    "Read",
    "Write",
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "LS",
    "Bash",
  ];

  (async () => {
    let completed = false;
    let sawPartialMessages = false;
    const toolMetaByIndex = new Map<number, { id: string; name: string }>();
    const partialToolInputByIndex = new Map<number, string>();
    const startedToolUseIds = new Set<string>();

    try {
      const prompt = buildPrompt(body.message, body.history, body.files);

      const sdkQuery = query({
        prompt,
        options: {
          cwd: process.cwd(),
          model: body.model,
          settingSources: [...settingSources],
          allowedTools,
          permissionMode: "dontAsk",
          includePartialMessages: true,
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: body.apiKey,
            ...(body.baseURL ? { ANTHROPIC_BASE_URL: body.baseURL } : {}),
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

              writer.write({
                type: "tool_start",
                toolUseId: contentBlock.id,
                toolName: contentBlock.name,
                toolInput: toRecord(contentBlock.input),
                timestamp: Date.now(),
              });
              startedToolUseIds.add(contentBlock.id);
            }
          } else if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta" && delta.text) {
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
              writer.write({
                type: "tool_start",
                toolUseId: toolMeta.id,
                toolName: toolMeta.name,
                toolInput: parseToolInput(partialInput),
                timestamp: Date.now(),
              });
              startedToolUseIds.add(toolMeta.id);
            }

            toolMetaByIndex.delete(event.index);
            partialToolInputByIndex.delete(event.index);
          }

          continue;
        }

        if (sdkMessage.type === "assistant") {
          if (!sawPartialMessages) {
            const text = extractAssistantText(sdkMessage);
            if (text) {
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
          if (!startedToolUseIds.has(sdkMessage.tool_use_id)) {
            writer.write({
              type: "tool_start",
              toolUseId: sdkMessage.tool_use_id,
              toolName: sdkMessage.tool_name,
              toolInput: {},
              timestamp: Date.now(),
            });
            startedToolUseIds.add(sdkMessage.tool_use_id);
          }
          continue;
        }

        const toolResult = extractToolResult(sdkMessage);
        if (toolResult) {
          writer.write({
            type: "tool_result",
            toolUseId: toolResult.toolUseId,
            result: toolResult.result,
            isError: toolResult.isError,
            timestamp: Date.now(),
          });
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
        writer.write({
          type: "text_complete",
          turnId,
          timestamp: Date.now(),
        });

        writer.write({
          type: "complete",
          timestamp: Date.now(),
        });
      }
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
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    writer.write({
      type: "error",
      error: message,
      timestamp: Date.now(),
    });
    writer.close();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
