"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { MainNav } from "@/components/app/main-nav";
import { ChatContainer } from "@/components/chat/chat-container";
import { Button } from "@/components/ui/button";
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

function buildSessionPreview(content: string): string | null {
  const trimmed = content.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "skill.sessions.sidebar.collapsed";
const GROUP_EXPANDED_STORAGE_KEY = "skill.sessions.groups.expanded";

function readSidebarCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
}

function readGroupExpandedStateFromStorage(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(GROUP_EXPANDED_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

interface SessionSidebarProps {
  groups: SessionGroup[];
  loadingGroups: boolean;
  selectedSessionId: string | null;
  creatingSkillId: string | null;
  groupExpandedState: Record<string, boolean>;
  onCreateSession: (skillId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onGroupExpandedChange: (skillId: string, isExpanded: boolean) => void;
}

const SessionSidebar = memo(function SessionSidebar({
  groups,
  loadingGroups,
  selectedSessionId,
  creatingSkillId,
  groupExpandedState,
  onCreateSession,
  onSelectSession,
  onGroupExpandedChange,
}: SessionSidebarProps) {
  return (
    <div className="border rounded-lg min-h-0 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {loadingGroups ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无会话，请从广场发起对话</div>
        ) : (
          groups.map((group) => {
            const isExpanded = groupExpandedState[group.skill.id] ?? true;
            return (
              <details
                key={group.skill.id}
                open={isExpanded}
                className="group rounded-md border p-2"
                onToggle={(event) => onGroupExpandedChange(group.skill.id, event.currentTarget.open)}
              >
                <summary className="list-none cursor-pointer rounded-md bg-muted/60 px-2 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-1.5">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Skill</span>
                    <span className="truncate">
                      {group.skill.icon ? `${group.skill.icon} ` : ""}
                      {group.skill.name}
                    </span>
                    {group.skill.status !== "published" && (
                      <span className="ml-auto text-xs text-muted-foreground">已下架</span>
                    )}
                  </div>
                </summary>
                <div className="mt-2 ml-2 border-l pl-2 space-y-1">
                  <button
                    type="button"
                    className="h-10 w-full rounded-md border border-dashed px-2 text-sm font-medium text-left flex items-center gap-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onCreateSession(group.skill.id)}
                    disabled={creatingSkillId !== null || group.skill.status !== "published"}
                  >
                    <Plus className="size-4 shrink-0" />
                    {creatingSkillId === group.skill.id ? "新建中..." : "新建会话"}
                  </button>

                  {group.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`h-10 w-full text-left rounded-md px-2 text-sm border transition ${
                        selectedSessionId === session.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/80 hover:bg-muted"
                      }`}
                      onClick={() => onSelectSession(session.id)}
                      title={session.title}
                    >
                      <span className="font-medium truncate block">{session.title}</span>
                    </button>
                  ))}
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
});

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() =>
    readSidebarCollapsedFromStorage()
  );
  const [groupExpandedState, setGroupExpandedState] = useState<Record<string, boolean>>(() =>
    readGroupExpandedStateFromStorage()
  );
  const [creatingSkillId, setCreatingSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModelConfig, setActiveModelConfig] = useState<ReturnType<typeof getActiveModelConfig>>(null);

  useEffect(() => {
    setActiveModelConfig(getActiveModelConfig(loadModelConfigs()));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        isSidebarCollapsed ? "1" : "0"
      );
    } catch {
      // ignore storage write errors
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        GROUP_EXPANDED_STORAGE_KEY,
        JSON.stringify(groupExpandedState)
      );
    } catch {
      // ignore storage write errors
    }
  }, [groupExpandedState]);

  const handleGroupExpandedChange = useCallback((skillId: string, isExpanded: boolean) => {
    setGroupExpandedState((prev) => {
      if (prev[skillId] === isExpanded) {
        return prev;
      }
      return {
        ...prev,
        [skillId]: isExpanded,
      };
    });
  }, []);

  const fetchGroups = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoadingGroups(true);
    }

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
      if (!silent) {
        setLoadingGroups(false);
      }
    }
  }, []);

  const fetchMessages = useCallback(
    async (sessionId: string, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoadingMessages(true);
        setError(null);
      }

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
      if (!silent) {
        setLoadingMessages(false);
      }
    }
    },
    []
  );

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

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setSelectedSessionId(sessionId);
      await fetchMessages(sessionId);
      router.replace(`/sessions?sessionId=${sessionId}`);
    },
    [fetchMessages, router]
  );

  const handleCreateSession = useCallback(
    async (skillId: string) => {
      setCreatingSkillId(skillId);
      setError(null);

      try {
        const res = await apiFetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "创建会话失败");
        }

        const sessionId = data.session?.id as string | undefined;
        await fetchGroups();

        if (sessionId) {
          setSelectedSessionId(sessionId);
          await fetchMessages(sessionId);
          router.replace(`/sessions?sessionId=${sessionId}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "创建会话失败";
        setError(message);
        toast.error(message);
      } finally {
        setCreatingSkillId(null);
      }
    },
    [fetchGroups, fetchMessages, router]
  );

  const optimisticSyncCurrentSession = useCallback(
    (sessionId: string, userContent: string, assistantContent: string) => {
      const nowIso = new Date().toISOString();
      const preview = buildSessionPreview(assistantContent) ?? buildSessionPreview(userContent);

      setGroups((prev) => {
        let changed = false;
        const nextGroups = prev.map((group) => {
          const sessionIndex = group.sessions.findIndex((session) => session.id === sessionId);
          if (sessionIndex === -1) return group;

          changed = true;
          const nextSessions = [...group.sessions];
          const target = nextSessions[sessionIndex];
          const updatedSession: SessionItem = {
            ...target,
            updatedAt: nowIso,
            lastMessagePreview: preview,
            lastMessageAt: nowIso,
          };

          nextSessions.splice(sessionIndex, 1);
          nextSessions.unshift(updatedSession);
          return { ...group, sessions: nextSessions };
        });

        return changed ? nextGroups : prev;
      });
    },
    []
  );

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
    const currentSessionId = selectedSessionId;

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
    let hasPendingAssistantUpdate = false;
    let frameId: number | null = null;

    const commitAssistantUpdate = () => {
      const nextToolCalls = Array.from(toolCalls.values());
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: streamContent,
                toolCalls: nextToolCalls.length > 0 ? nextToolCalls : undefined,
              }
            : item
        )
      );
    };

    const queueAssistantUpdate = () => {
      hasPendingAssistantUpdate = true;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (!hasPendingAssistantUpdate) return;
        hasPendingAssistantUpdate = false;
        commitAssistantUpdate();
      });
    };

    const flushAssistantUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (!hasPendingAssistantUpdate) return;
      hasPendingAssistantUpdate = false;
      commitAssistantUpdate();
    };

    const settleRunningToolCalls = (status: "completed" | "error") => {
      let changed = false;
      for (const [toolUseId, toolCall] of toolCalls.entries()) {
        if (toolCall.status === "running") {
          toolCalls.set(toolUseId, {
            ...toolCall,
            status,
          });
          changed = true;
        }
      }
      if (changed) {
        queueAssistantUpdate();
      }
    };

    try {
      const response = await apiFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
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
              queueAssistantUpdate();
            } else if (event.type === "tool_start") {
              const existing = toolCalls.get(event.toolUseId);
              toolCalls.set(event.toolUseId, {
                id: event.toolUseId,
                name: event.toolName,
                input: event.toolInput,
                status: existing?.status === "error" || existing?.status === "completed"
                  ? existing.status
                  : "running",
                result: existing?.result,
              });
              queueAssistantUpdate();
            } else if (event.type === "tool_result") {
              const existing = toolCalls.get(event.toolUseId);
              toolCalls.set(event.toolUseId, {
                id: event.toolUseId,
                name: existing?.name ?? "Tool",
                input: existing?.input ?? {},
                status: event.isError ? "error" : "completed",
                result: event.result,
              });
              queueAssistantUpdate();
            } else if (event.type === "complete") {
              settleRunningToolCalls("completed");
            } else if (event.type === "error") {
              setError(event.error);
              settleRunningToolCalls("error");
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送消息失败");
    } finally {
      flushAssistantUpdate();
      setIsStreaming(false);
      optimisticSyncCurrentSession(currentSessionId, message, streamContent);
      void fetchGroups({ silent: true });
    }
  };

  const sidebarToggleLabel = isSidebarCollapsed ? "展开会话侧边栏" : "折叠会话侧边栏";

  return (
    <div className="h-dvh p-6 flex flex-col gap-4 overflow-hidden">
      <div className="flex justify-center">
        <MainNav />
      </div>

      {!activeModelConfig && (
        <div className="text-sm bg-yellow-500/10 text-yellow-700 rounded-md border border-yellow-500/30 p-2">
          未发现激活模型，请先到“模型”模块配置并激活。
        </div>
      )}

      <div
        className={`flex-1 min-h-0 min-w-0 grid overflow-visible transition-[grid-template-columns] ${
          isSidebarCollapsed ? "grid-cols-1" : "grid-cols-[320px_minmax(0,1fr)] gap-4"
        }`}
      >
        {!isSidebarCollapsed && (
          <SessionSidebar
            groups={groups}
            loadingGroups={loadingGroups}
            selectedSessionId={selectedSessionId}
            creatingSkillId={creatingSkillId}
            groupExpandedState={groupExpandedState}
            onCreateSession={handleCreateSession}
            onSelectSession={handleSelectSession}
            onGroupExpandedChange={handleGroupExpandedChange}
          />
        )}

        <div className="relative min-h-0 min-w-0 overflow-visible">
          <Button
            variant="outline"
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="absolute left-0 top-1/2 z-20 hidden h-10 w-7 -translate-x-1/2 -translate-y-1/2 rounded-md bg-background px-0 shadow-sm hover:bg-muted md:inline-flex"
            aria-label={sidebarToggleLabel}
          >
            {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
          <div className="border rounded-lg min-h-0 min-w-0 h-full overflow-hidden">
            <div className="h-full min-w-0 overflow-hidden rounded-lg flex flex-col min-h-0">
              <div className="md:hidden border-b px-3 py-2 flex justify-end shrink-0">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="h-8 w-8 rounded-md bg-background p-0 shadow-sm hover:bg-muted"
                  aria-label={sidebarToggleLabel}
                >
                  {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </Button>
              </div>
              {selectedSessionId ? (
                loadingMessages ? (
                  <div className="p-4 text-sm text-muted-foreground">加载消息中...</div>
                ) : (
                  <div className="h-full min-w-0 flex flex-col min-h-0">
                    {sessionDetail && (
                      <div className="border-b p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium truncate">
                            {sessionDetail.skill.icon ? `${sessionDetail.skill.icon} ` : ""}
                            {sessionDetail.title}
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            Skill 状态: {sessionDetail.skill.status}
                          </div>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="mx-4 mt-2 bg-destructive/10 text-destructive p-2 text-sm rounded">
                        {error}
                      </div>
                    )}
                    <div className="flex-1 min-h-0 min-w-0">
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
      </div>
    </div>
  );
}
