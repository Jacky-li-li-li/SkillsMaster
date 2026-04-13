"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MainNav } from "@/components/app/main-nav";
import { ChatContainer } from "@/components/chat/chat-container";
import { apiFetch } from "@/lib/client/api";
import { getActiveModelConfig, loadModelConfigs } from "@/lib/client/model-config";
import type { AgentEvent } from "@/lib/agent/event-types";

interface SessionItem {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

interface SessionGroup {
  skill: {
    id: string;
    name: string;
    icon: string | null;
    status: "draft" | "published" | "unpublished";
    shareSlug: string;
  };
  sessions: SessionItem[];
}

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: unknown;
  createdAt: string;
}

interface SessionDetail {
  id: string;
  title: string;
  status: "active" | "archived";
  skill: {
    id: string;
    name: string;
    icon: string | null;
    status: "draft" | "published" | "unpublished";
    shareSlug: string;
  };
}

interface ChatUiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    status: "running" | "completed" | "error";
    result?: string;
  }>;
}

function normalizeToolCalls(value: unknown): ChatUiMessage["toolCalls"] {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;

      const status = obj.status;
      if (typeof obj.id !== "string" || typeof obj.name !== "string") {
        return null;
      }

      let normalizedStatus: "running" | "completed" | "error";
      if (status === "running" || status === "completed" || status === "error") {
        normalizedStatus = status;
      } else {
        return null;
      }

      return {
        id: obj.id,
        name: obj.name,
        input:
          obj.input && typeof obj.input === "object" && !Array.isArray(obj.input)
            ? (obj.input as Record<string, unknown>)
            : {},
        status: normalizedStatus,
        result: typeof obj.result === "string" ? obj.result : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return items.length > 0 ? items : undefined;
}

export default function SessionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeModelConfig = useMemo(() => {
    const configs = loadModelConfigs();
    return getActiveModelConfig(configs);
  }, []);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await apiFetch("/api/sessions");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "加载会话列表失败");
      }
      setGroups(data.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载会话列表失败");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/messages`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "加载消息失败");
      }

      setSessionDetail(data.session);
      const mapped: ChatUiMessage[] = (data.messages as SessionMessage[]).map((item) => ({
        id: item.id,
        role: item.role === "user" ? "user" : "assistant",
        content:
          item.role === "system"
            ? `[系统消息]\n${item.content}`
            : item.content,
        timestamp: new Date(item.createdAt).getTime(),
        toolCalls: normalizeToolCalls(item.toolCalls),
      }));
      setMessages(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载消息失败");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    const querySessionId = searchParams.get("sessionId");
    if (querySessionId) {
      setSelectedSessionId(querySessionId);
      fetchMessages(querySessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    await fetchMessages(sessionId);
    router.replace(`/sessions?sessionId=${sessionId}`);
  };

  const sendMessage = async (message: string) => {
    if (!selectedSessionId) {
      toast.error("请先选择会话");
      return;
    }

    if (!activeModelConfig) {
      toast.error("请先在“模型”模块配置并激活一个模型");
      return;
    }

    setError(null);
    setIsStreaming(true);

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: message, timestamp: Date.now() },
      { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
    ]);

    const toolCalls = new Map<
      string,
      {
        id: string;
        name: string;
        input: Record<string, unknown>;
        status: "running" | "completed" | "error";
        result?: string;
      }
    >();

    let streamContent = "";

    try {
      const response = await apiFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          message,
          modelConfig: {
            model: activeModelConfig.model,
            apiKey: activeModelConfig.apiKey,
            baseURL: activeModelConfig.baseURL,
          },
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "发送消息失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6)) as AgentEvent;
            if (event.type === "text_delta") {
              streamContent += event.delta;
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId
                    ? { ...item, content: streamContent }
                    : item
                )
              );
            } else if (event.type === "tool_start") {
              toolCalls.set(event.toolUseId, {
                id: event.toolUseId,
                name: event.toolName,
                input: event.toolInput,
                status: "running",
              });
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId
                    ? { ...item, toolCalls: Array.from(toolCalls.values()) }
                    : item
                )
              );
            } else if (event.type === "tool_result") {
              const existing = toolCalls.get(event.toolUseId);
              if (existing) {
                toolCalls.set(event.toolUseId, {
                  ...existing,
                  status: event.isError ? "error" : "completed",
                  result: event.result,
                });
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantId
                      ? { ...item, toolCalls: Array.from(toolCalls.values()) }
                      : item
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送消息失败");
    } finally {
      setIsStreaming(false);
      await fetchGroups();
      await fetchMessages(selectedSessionId);
    }
  };

  return (
    <div className="h-screen p-6 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">会话</h1>
        <MainNav />
      </div>

      {!activeModelConfig && (
        <div className="text-sm bg-yellow-500/10 text-yellow-700 rounded-md border border-yellow-500/30 p-2">
          未发现激活模型，请先到“模型”模块配置并激活。
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-4 overflow-hidden">
        <div className="border rounded-lg p-3 overflow-auto space-y-3">
          {loadingGroups ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无会话，请从广场发起对话</div>
          ) : (
            groups.map((group) => (
              <details key={group.skill.id} open className="rounded-md border p-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {group.skill.icon ? `${group.skill.icon} ` : ""}
                  {group.skill.name}
                  {group.skill.status !== "published" ? " (已下架)" : ""}
                </summary>
                <div className="mt-2 space-y-1">
                  {group.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`w-full text-left rounded px-2 py-1 text-sm border ${
                        selectedSessionId === session.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <div className="font-medium truncate">{session.title}</div>
                      {session.lastMessagePreview && (
                        <div className="text-xs opacity-80 truncate">{session.lastMessagePreview}</div>
                      )}
                    </button>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>

        <div className="border rounded-lg overflow-hidden min-h-0">
          {selectedSessionId ? (
            loadingMessages ? (
              <div className="p-4 text-sm text-muted-foreground">加载消息中...</div>
            ) : (
              <div className="h-full flex flex-col min-h-0">
                {sessionDetail && (
                  <div className="border-b p-3 text-sm">
                    <div className="font-medium">
                      {sessionDetail.skill.icon ? `${sessionDetail.skill.icon} ` : ""}
                      {sessionDetail.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Skill 状态: {sessionDetail.skill.status}
                    </div>
                  </div>
                )}
                {error && (
                  <div className="mx-4 mt-2 bg-destructive/10 text-destructive p-2 text-sm rounded">
                    {error}
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <ChatContainer
                    messages={messages}
                    isStreaming={isStreaming}
                    onSend={sendMessage}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="p-4 text-sm text-muted-foreground">请从左侧选择会话</div>
          )}
        </div>
      </div>
    </div>
  );
}
