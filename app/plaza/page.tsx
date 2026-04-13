"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { MainNav } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/api";

interface PlazaSkill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  shareSlug: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export default function PlazaPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<PlazaSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/plaza/skills");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "加载广场失败");
      }
      setSkills(data.skills || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载广场失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleLike = async (skillId: string) => {
    setPendingSkillId(skillId);
    try {
      const res = await apiFetch(`/api/plaza/skills/${skillId}/like`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "点赞失败");
      }

      setSkills((prev) =>
        prev.map((item) =>
          item.id === skillId
            ? {
                ...item,
                likedByMe: data.likedByMe,
                likeCount: data.likeCount,
              }
            : item
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "点赞失败");
    } finally {
      setPendingSkillId(null);
    }
  };

  const handleStartChat = async (skillId: string) => {
    setPendingSkillId(skillId);
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

      router.push(`/sessions?sessionId=${data.session.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建会话失败");
    } finally {
      setPendingSkillId(null);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Skill广场</h1>
        <MainNav />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中...</div>
      ) : skills.length === 0 ? (
        <div className="text-sm text-muted-foreground">暂无已发布 Skill</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => {
            const busy = pendingSkillId === skill.id;
            const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${skill.shareSlug}`;

            return (
              <Card key={skill.id}>
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={skill.author.avatarUrl || `https://api.dicebear.com/9.x/thumbs/svg?seed=${skill.author.id}`}
                      alt={skill.author.displayName}
                      className="w-10 h-10 rounded-full border"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{skill.author.displayName}</div>
                      <div className="text-xs text-muted-foreground">{new Date(skill.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {skill.icon && <span>{skill.icon}</span>}
                      <span className="truncate">{skill.name}</span>
                    </CardTitle>
                    {skill.description && (
                      <CardDescription className="line-clamp-2 mt-1">{skill.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={skill.likedByMe ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleLike(skill.id)}
                      disabled={busy}
                    >
                      <Heart className="h-4 w-4 mr-1" />
                      {skill.likeCount}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleStartChat(skill.id)}
                      disabled={busy}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      对话
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground break-all">分享链接: {shareUrl}</div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
