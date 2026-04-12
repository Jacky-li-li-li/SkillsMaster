"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentEvent } from "@/lib/agent/event-types";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

interface UseAgentStreamReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
}

interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
}

interface UseAgentStreamOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
  files?: FileInfo[];
}

const CHAT_MESSAGES_STORAGE_KEY = "skills-master-chat-messages";

function isToolCallStatus(
  value: unknown
): value is "running" | "completed" | "error" {
  return value === "running" || value === "completed" || value === "error";
}

function parseStoredMessages(raw: string | null): Message[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): Message | null => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;

        const role = obj.role;
        if (role !== "user" && role !== "assistant") return null;

        const toolCalls = Array.isArray(obj.toolCalls)
          ? obj.toolCalls
              .map((tool): ToolCall | null => {
                if (!tool || typeof tool !== "object") return null;
                const toolObj = tool as Record<string, unknown>;
                if (!isToolCallStatus(toolObj.status)) return null;
                if (typeof toolObj.id !== "string" || typeof toolObj.name !== "string") {
                  return null;
                }

                return {
                  id: toolObj.id,
                  name: toolObj.name,
                  input:
                    toolObj.input && typeof toolObj.input === "object" && !Array.isArray(toolObj.input)
                      ? (toolObj.input as Record<string, unknown>)
                      : {},
                  status: toolObj.status,
                  result: typeof toolObj.result === "string" ? toolObj.result : undefined,
                };
              })
              .filter((tool): tool is ToolCall => tool !== null)
          : undefined;

        return {
          id: typeof obj.id === "string" ? obj.id : `msg-${index}-${Date.now()}`,
          role,
          content: typeof obj.content === "string" ? obj.content : "",
          timestamp: typeof obj.timestamp === "number" ? obj.timestamp : Date.now(),
          toolCalls,
        };
      })
      .filter((item): item is Message => item !== null);
  } catch {
    return [];
  }
}

export function useAgentStream(
  options: UseAgentStreamOptions
): UseAgentStreamReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamingContentRef = useRef("");
  const toolCallsRef = useRef<Map<string, ToolCall>>(new Map());
  const hasLoadedPersistedMessagesRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restored = parseStoredMessages(
      window.localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)
    );
    if (restored.length > 0) {
      setMessages(restored);
    }
    hasLoadedPersistedMessagesRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedPersistedMessagesRef.current) return;

    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          CHAT_MESSAGES_STORAGE_KEY,
          JSON.stringify(messages)
        );
      }
    } catch {
      // ignore storage write errors
    }
  }, [messages]);

  const processStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      decoder: TextDecoder,
      assistantId: string
    ) => {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr) as AgentEvent;

            if (event.type === "text_delta") {
              streamingContentRef.current += event.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: streamingContentRef.current }
                    : m
                )
              );
            } else if (event.type === "tool_start") {
              const toolCall: ToolCall = {
                id: event.toolUseId,
                name: event.toolName,
                input: event.toolInput,
                status: "running",
              };
              toolCallsRef.current.set(event.toolUseId, toolCall);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: Array.from(toolCallsRef.current.values()) }
                    : m
                )
              );
            } else if (event.type === "tool_result") {
              const toolCall = toolCallsRef.current.get(event.toolUseId);
              if (toolCall) {
                toolCall.status = event.isError ? "error" : "completed";
                toolCall.result = event.result;
                toolCallsRef.current.set(event.toolUseId, toolCall);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: Array.from(toolCallsRef.current.values()) }
                      : m
                  )
                );
              }
            } else if (event.type === "error") {
              setError(event.error);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!options.apiKey) {
        setError("API Key is required");
        return;
      }

      setError(null);
      setIsStreaming(true);
      streamingContentRef.current = "";
      toolCallsRef.current = new Map();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      try {
        // 构建对话历史（只包含 user 和 assistant 的消息内容）
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // 构建文件信息（只发送名称和内容）
        const files = options.files?.map((f) => ({
          name: f.name,
          content: f.content,
        }));

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            files,
            apiKey: options.apiKey,
            baseURL: options.baseURL,
            model: options.model,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to connect to agent");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        await processStream(reader, decoder, assistantId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsStreaming(false);
      }
    },
    [options.apiKey, options.baseURL, options.model, options.files, messages, processStream]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    }
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages };
}
