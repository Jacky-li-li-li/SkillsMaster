"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChatContainer } from "@/components/chat/chat-container";
import { FileList, type UploadedFile } from "@/components/chat/file-list";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_BASE_URL } from "@/lib/constants";

export default function ChatPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("skills-master-api-key") ?? "";
  });
  const [baseURL, setBaseURL] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_BASE_URL;
    return localStorage.getItem("skills-master-base-url") ?? DEFAULT_BASE_URL;
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const { messages, isStreaming, error, sendMessage, clearMessages } = useAgentStream({
    apiKey,
    baseURL,
    files: uploadedFiles,
  });

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem("skills-master-api-key", value);
    toast.success("API Key 保存成功");
  };

  const handleBaseURLChange = (value: string) => {
    setBaseURL(value);
    localStorage.setItem("skills-master-base-url", value);
    toast.success("Base URL 保存成功");
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r p-4 flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseURL">Base URL</Label>
            <Input
              id="baseURL"
              value={baseURL}
              onChange={(e) => handleBaseURLChange(e.target.value)}
              placeholder="https://api.minimaxi.com/anthropic"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
            disabled={messages.length === 0 || isStreaming}
          >
            清空对话
          </Button>

          <FileList files={uploadedFiles} onFilesChange={setUploadedFiles} />

          <div className="space-y-2">
            <Label>Skills</Label>
            <p className="text-xs text-muted-foreground">
              Claude Agent SDK 会自动发现并按需触发可用 Skills
            </p>
            <div className="text-xs text-muted-foreground py-2">
              请在“管理 Skills”页面创建或维护本地 Skills
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push("/skills")}
            >
              管理 Skills
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {error && (
            <div className="bg-destructive/10 text-destructive p-2 text-sm">
              {error}
            </div>
          )}
          <ChatContainer
            messages={messages}
            isStreaming={isStreaming}
            onSend={sendMessage}
          />
        </div>
      </div>
    </div>
  );
}
