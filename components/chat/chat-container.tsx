"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

const BOTTOM_THRESHOLD_PX = 80;

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
  toolCalls?: ToolCall[];
}

interface ChatContainerProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (message: string) => void;
}

export function ChatContainer({
  messages,
  isStreaming,
  onSend,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const prevLastAssistantRef = useRef<{ id: string | null; contentLength: number }>({
    id: null,
    contentLength: 0,
  });
  const scrollFrameRef = useRef<number | null>(null);
  const shouldAutoFollowRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const syncFollowState = useCallback((viewport: HTMLDivElement) => {
    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nearBottom = distanceToBottom <= BOTTOM_THRESHOLD_PX;
    shouldAutoFollowRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    shouldAutoFollowRef.current = true;
    setIsNearBottom(true);
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (!shouldAutoFollowRef.current) return;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  const handleJumpToBottom = () => {
    shouldAutoFollowRef.current = true;
    scheduleScrollToBottom();
  };

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      syncFollowState(viewport);
    };

    handleScroll();
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [syncFollowState]);

  useEffect(() => {
    const currentCount = messages.length;
    const previousCount = prevMessageCountRef.current;
    const lastMessage = messages[currentCount - 1];
    const previousMessage = messages[currentCount - 2];
    const lastAssistant =
      lastMessage?.role === "assistant" ? lastMessage : null;
    const previousLastAssistant = prevLastAssistantRef.current;
    const isAssistantTextGrowing =
      isStreaming &&
      lastAssistant !== null &&
      previousLastAssistant.id === lastAssistant.id &&
      lastAssistant.content.length > previousLastAssistant.contentLength;
    const isSendActionStart =
      currentCount > previousCount &&
      isStreaming &&
      lastMessage?.role === "assistant" &&
      previousMessage?.role === "user";
    const hasMessageCountChanged = currentCount !== previousCount;

    if (isSendActionStart) {
      shouldAutoFollowRef.current = true;
      scheduleScrollToBottom();
    }

    if (
      shouldAutoFollowRef.current &&
      (hasMessageCountChanged || isAssistantTextGrowing)
    ) {
      scheduleScrollToBottom();
    }

    prevMessageCountRef.current = currentCount;
    prevLastAssistantRef.current = {
      id: lastAssistant?.id ?? null,
      contentLength: lastAssistant?.content.length ?? 0,
    };
  }, [isStreaming, messages, scheduleScrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const showJumpToBottom = !isNearBottom && messages.length > 0;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
        <ScrollArea className="h-full min-w-0 p-4" viewportRef={scrollRef}>
          <div className="space-y-4 pb-3 min-w-0">
            {messages.map((msg, index) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                toolCalls={msg.toolCalls}
                isStreaming={isStreaming && index === messages.length - 1 && msg.role === "assistant"}
              />
            ))}
          </div>
        </ScrollArea>
        {showJumpToBottom && (
          <button
            type="button"
            onClick={handleJumpToBottom}
            aria-label="回到底部"
            title="回到底部"
            className="absolute bottom-6 right-6 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background/95 shadow-sm backdrop-blur hover:bg-muted"
          >
            <ArrowDown className="size-3.5" />
          </button>
        )}
      </div>
      <div className="border-t p-4 shrink-0">
        <ChatInput onSend={onSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
