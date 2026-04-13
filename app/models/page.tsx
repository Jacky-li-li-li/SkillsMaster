"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MainNav } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getActiveModelConfig,
  loadModelConfigs,
  saveModelConfigs,
  type ModelConfig,
} from "@/lib/client/model-config";
import { DEFAULT_BASE_URL } from "@/lib/constants";

function newConfig(): ModelConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    model: "claude-sonnet-4-20250514",
    baseURL: DEFAULT_BASE_URL,
    apiKey: "",
    isActive: false,
  };
}

export default function ModelsPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>(() => loadModelConfigs());
  const [draft, setDraft] = useState<ModelConfig>(newConfig());

  const activeConfig = useMemo(() => getActiveModelConfig(configs), [configs]);

  const commitConfigs = (next: ModelConfig[]) => {
    setConfigs(next);
    saveModelConfigs(next);
  };

  const handleAdd = () => {
    if (!draft.name.trim() || !draft.model.trim() || !draft.apiKey.trim()) {
      toast.error("请填写名称、模型 ID 和 API Key");
      return;
    }

    const hasActive = configs.some((item) => item.isActive);
    const next: ModelConfig[] = [
      ...configs,
      {
        ...draft,
        isActive: !hasActive,
      },
    ];

    commitConfigs(next);
    setDraft(newConfig());
    toast.success("模型配置已添加");
  };

  const handleActivate = (id: string) => {
    const next = configs.map((item) => ({
      ...item,
      isActive: item.id === id,
    }));
    commitConfigs(next);
    toast.success("已切换激活模型");
  };

  const handleRemove = (id: string) => {
    const target = configs.find((item) => item.id === id);
    const next = configs.filter((item) => item.id !== id);

    if (target?.isActive && next.length > 0) {
      next[0].isActive = true;
    }

    commitConfigs(next);
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">模型</h1>
        <MainNav />
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">新增模型配置</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>配置名称</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：Sonnet-生产"
            />
          </div>
          <div className="space-y-2">
            <Label>模型 ID</Label>
            <Input
              value={draft.model}
              onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
              placeholder="claude-sonnet-4-20250514"
            />
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={draft.baseURL}
              onChange={(e) => setDraft((prev) => ({ ...prev, baseURL: e.target.value }))}
              placeholder="https://api.minimaxi.com/anthropic"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-ant-..."
            />
          </div>
        </div>
        <Button onClick={handleAdd}>添加模型</Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">已配置模型（仅可激活一个）</h2>
        {configs.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无配置，请先添加。</div>
        ) : (
          <div className="space-y-2">
            {configs.map((item) => (
              <div key={item.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground break-all">{item.model}</div>
                  <div className="text-xs text-muted-foreground break-all">{item.baseURL}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={item.isActive ? "default" : "outline"}
                    onClick={() => handleActivate(item.id)}
                  >
                    {item.isActive ? "已激活" : "激活"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRemove(item.id)}>
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        当前激活模型：{activeConfig ? `${activeConfig.name} (${activeConfig.model})` : "未配置"}
      </div>
    </div>
  );
}
