"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

interface ToolCallBlock {
  type: "tool_call";
  tool: string;
  args: Record<string, string>;
  raw: string;
}

interface TextBlock {
  type: "text";
  content: string;
}

type ContentBlock = ToolCallBlock | TextBlock;

function hasVisibleContent(text: string): boolean {
  return text.trim().length > 0;
}

function unwrapEntireMarkdownFence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1] : content;
}

function isWordLikeChar(char: string): boolean {
  return /[A-Za-z0-9_\u4e00-\u9fff]/.test(char);
}

function isPunctuationChar(char: string): boolean {
  return /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~，。！？、：；“”‘’（）【】《》]/.test(
    char
  );
}

function normalizeStrongEmphasisEdges(content: string): string {
  return content.replace(/\*\*([^*\n]+?)\*\*/g, (match, rawInner, offset, fullText) => {
    let inner = rawInner.trim();
    if (!inner) return match;

    const before = offset > 0 ? fullText[offset - 1] : "";
    const after = fullText[offset + match.length] ?? "";
    let prefix = "";
    let suffix = "";

    const firstChar = inner[0];
    if (firstChar && isPunctuationChar(firstChar) && isWordLikeChar(before)) {
      prefix = firstChar;
      inner = inner.slice(1).trimStart();
    }

    const lastChar = inner[inner.length - 1];
    if (lastChar && isPunctuationChar(lastChar) && isWordLikeChar(after)) {
      suffix = lastChar;
      inner = inner.slice(0, -1).trimEnd();
    }

    if (!inner) return match;
    return `${prefix}**${inner}**${suffix}`;
  });
}

function normalizeMarkdownOutsideCodeFences(content: string): string {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment, index) => {
      // odd index segments are fenced code blocks - keep untouched
      if (index % 2 === 1) return segment;
      return normalizeStrongEmphasisEdges(
        segment
        .replace(/\*\*\s+([^*\n][^*\n]*?)\s+\*\*/g, "**$1**")
        .replace(/__\s+([^_\n][^_\n]*?)\s+__/g, "__$1__")
      );
    })
    .join("");
}

function normalizeMarkdownForRender(content: string): string {
  const unwrapped = unwrapEntireMarkdownFence(content);
  return normalizeMarkdownOutsideCodeFences(unwrapped);
}

function parseToolCallArgs(argsStr: string): Record<string, string> {
  const args: Record<string, string> = {};
  const lines = argsStr.trim().split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*--(\w+)\s+"?([^"]*)"?\s*$/);
    if (match) {
      args[match[1]] = match[2];
    } else {
      const simpleMatch = line.match(/^\s*--(\w+)\s+(.+)$/);
      if (simpleMatch) {
        args[simpleMatch[1]] = simpleMatch[2].trim();
      }
    }
  }
  return args;
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const toolCallRegex = /\[TOOL_CALL\]\s*\{tool\s*=>\s*"([^"]+)",\s*args\s*=>\s*\{([^}]*)\}\s*\}\s*\[\/TOOL_CALL\]/g;

  let lastIndex = 0;
  let match;

  while ((match = toolCallRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (hasVisibleContent(textBefore)) {
        blocks.push({ type: "text", content: textBefore });
      }
    }

    blocks.push({
      type: "tool_call",
      tool: match[1],
      args: parseToolCallArgs(match[2]),
      raw: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (hasVisibleContent(remaining)) {
      blocks.push({ type: "text", content: remaining });
    }
  }

  if (blocks.length === 0 && hasVisibleContent(content)) {
    blocks.push({ type: "text", content });
  }

  return blocks;
}

function ToolCallCard({ block }: { block: ToolCallBlock }) {
  return (
    <div className="my-2 rounded-lg border bg-muted/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/80 border-b">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">调用工具: {block.tool}</span>
      </div>
      <div className="p-3">
        <pre className="max-w-full whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-xs text-muted-foreground">
          {Object.entries(block.args).map(([key, value]) => (
            <div key={key}>
              <span className="text-primary">--{key}</span> {value}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function RealToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const isRunning = toolCall.status === "running";
  const isCollapsible = !isRunning;
  const [isExpanded, setIsExpanded] = useState(() => isRunning);

  useEffect(() => {
    setIsExpanded(isRunning);
  }, [isRunning]);

  const handleToggleExpand = () => {
    if (!isCollapsible) return;
    setIsExpanded((prev) => !prev);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isCollapsible) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  };

  const statusIcon = {
    running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const statusText = {
    running: "执行中",
    completed: "",
    error: "失败",
  };

  return (
    <div
      className={cn(
        "my-2 rounded-lg border bg-muted/50 overflow-hidden",
        isCollapsible && "cursor-pointer"
      )}
      onClick={handleToggleExpand}
      onKeyDown={handleKeyDown}
      role={isCollapsible ? "button" : undefined}
      tabIndex={isCollapsible ? 0 : undefined}
      aria-expanded={isCollapsible ? isExpanded : undefined}
      aria-controls={isCollapsible ? `tool-call-body-${toolCall.id}` : undefined}
      aria-label={
        isCollapsible
          ? `${toolCall.name} 工具调用详情${isExpanded ? "，点击收起" : "，点击展开"}`
          : undefined
      }
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/80 border-b">
        {statusIcon[toolCall.status]}
        <span className="text-sm font-medium">{toolCall.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {statusText[toolCall.status] ? (
            <span className="text-xs text-muted-foreground">{statusText[toolCall.status]}</span>
          ) : null}
          {isCollapsible && (
            <span className="text-muted-foreground" aria-hidden>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="p-3 space-y-2" id={`tool-call-body-${toolCall.id}`}>
          <div>
            <div className="text-xs text-muted-foreground mb-1">参数:</div>
            <pre className="max-w-full whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-xs bg-background/50 p-2 rounded">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">结果:</div>
              <pre className="max-w-full whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-xs bg-background/50 p-2 rounded max-h-32 overflow-auto">
                {toolCall.result.slice(0, 500)}
                {toolCall.result.length > 500 && "..."}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-sm leading-6 break-words [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-muted text-sm break-all" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <pre className="my-2 max-w-full p-3 rounded-lg bg-muted overflow-x-auto">
                <code className={cn("text-sm", className)} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 break-words [overflow-wrap:anywhere]">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1 break-words [overflow-wrap:anywhere]">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1 break-words [overflow-wrap:anywhere]">{children}</ol>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/30 pl-4 my-2 text-muted-foreground break-words [overflow-wrap:anywhere]">
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-2 break-words [overflow-wrap:anywhere]">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 break-words [overflow-wrap:anywhere]">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-bold mb-2 break-words [overflow-wrap:anywhere]">{children}</h3>;
          },
          table({ children }) {
            return (
              <div className="my-3 w-full max-w-full overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-background/60">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="border-b border-border">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="border border-border px-3 py-2 text-left font-semibold align-top break-words [overflow-wrap:anywhere]">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2 align-top break-words [overflow-wrap:anywhere]">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function AssistantStreamingIndicator({ hasText }: { hasText: boolean }) {
  return (
    <div
      className={cn(
        "model-streaming-indicator mt-3 min-h-[0.875rem]",
        hasText && "model-streaming-indicator--subtle"
      )}
      role="status"
      aria-live="polite"
      aria-label="模型生成中"
    >
      <div className="model-streaming-indicator__track">
        <span className="model-streaming-indicator__wave" aria-hidden />
      </div>
      <div className="model-streaming-indicator__meta">
        <span className="model-streaming-indicator__dot" aria-hidden />
      </div>
    </div>
  );
}

export function ChatMessage({ role, content, toolCalls, isStreaming }: ChatMessageProps) {
  const isAssistantStreaming = role === "assistant" && Boolean(isStreaming);
  const renderContent = useMemo(
    () =>
      isAssistantStreaming
        ? content
        : role === "assistant"
          ? normalizeMarkdownForRender(content)
          : content,
    [role, content, isAssistantStreaming]
  );
  const blocks = useMemo(
    () => (isAssistantStreaming ? [] : parseContent(renderContent)),
    [renderContent, isAssistantStreaming]
  );
  const hasGeneratedText = useMemo(
    () =>
      isAssistantStreaming
        ? hasVisibleContent(content)
        : blocks.some(
            (block) => block.type === "text" && hasVisibleContent(block.content)
          ),
    [blocks, content, isAssistantStreaming]
  );
  const showStreamingIndicator = isAssistantStreaming;
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!renderContent) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(renderContent);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = renderContent;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn(
        "group/message flex w-full",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-full sm:max-w-[80%] min-w-0 flex flex-col gap-1",
          role === "user" ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-lg px-4 py-2 min-w-0 max-w-full overflow-hidden border",
            role === "user"
              ? "bg-black text-white border-black/70 dark:bg-black dark:border-white/15"
              : "bg-muted text-foreground border-border/70"
          )}
        >
          {/* 显示来自 hook 的真实工具调用 */}
          {toolCalls && toolCalls.length > 0 && (
            <div className="space-y-2 mb-2">
              {toolCalls.map((tc) => (
                <RealToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
          {/* 流式阶段走轻量纯文本渲染，结束后再完整渲染 Markdown */}
          {isAssistantStreaming ? (
            <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 max-w-full">
              {content}
            </pre>
          ) : (
            blocks.map((block, index) => (
              <div key={index}>
                {block.type === "tool_call" ? (
                  <ToolCallCard block={block} />
                ) : (
                  <MarkdownContent content={block.content} />
                )}
              </div>
            ))
          )}
          {showStreamingIndicator && (
            <AssistantStreamingIndicator hasText={hasGeneratedText} />
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "已复制消息" : "复制消息"}
          title={copied ? "已复制" : "复制"}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md transition-opacity",
            "opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100",
            "hover:bg-accent hover:text-accent-foreground",
            copied ? "text-green-600" : "text-muted-foreground"
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
