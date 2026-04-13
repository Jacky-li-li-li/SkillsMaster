"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { MainNav } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/api";

interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MySkill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  contentMarkdown: string;
  icon: string | null;
  status: "draft" | "published" | "unpublished";
  shareSlug: string;
  publishedAt: string | null;
  updatedAt: string;
}

interface SkillDraft {
  name: string;
  description: string;
  contentMarkdown: string;
  icon: string;
}

const EMPTY_DRAFT: SkillDraft = {
  name: "",
  description: "",
  contentMarkdown: "",
  icon: "",
};

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<MySkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDraft, setCreateDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, skillsRes] = await Promise.all([
        apiFetch("/api/me/profile"),
        apiFetch("/api/me/skills"),
      ]);

      const profileData = await profileRes.json();
      const skillsData = await skillsRes.json();

      if (!profileRes.ok) {
        throw new Error(profileData.error || "加载个人信息失败");
      }
      if (!skillsRes.ok) {
        throw new Error(skillsData.error || "加载技能失败");
      }

      setProfile(profileData.profile);
      setSkills(skillsData.skills || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profileAvatarPreview = useMemo(() => {
    if (!profile) return "";
    return profile.avatarUrl || `https://api.dicebear.com/9.x/thumbs/svg?seed=${profile.id}`;
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存失败");
      }
      setProfile(data.profile);
      toast.success("个人信息已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSkill = async () => {
    if (!createDraft.name.trim() || !createDraft.contentMarkdown.trim()) {
      toast.error("请填写技能名称和内容");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/me/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "创建失败");
      }

      setCreateDraft(EMPTY_DRAFT);
      toast.success("技能草稿已创建");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSkill = async (id: string) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/me/skills/${id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "发布失败");
      }

      toast.success("技能已发布/更新");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublishSkill = async (id: string) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/me/skills/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "下架失败");
      }

      toast.success("技能已下架");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下架失败");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (skill: MySkill) => {
    setEditingSkillId(skill.id);
    setEditingDraft({
      name: skill.name,
      description: skill.description || "",
      contentMarkdown: skill.contentMarkdown,
      icon: skill.icon || "",
    });
  };

  const handleSaveEdit = async (skillId: string) => {
    if (!editingDraft.name.trim() || !editingDraft.contentMarkdown.trim()) {
      toast.error("请填写技能名称和内容");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/me/skills/${skillId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存失败");
      }

      setEditingSkillId(null);
      toast.success("技能已更新");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async (shareSlug: string) => {
    const url = `${window.location.origin}/s/${shareSlug}`;
    await navigator.clipboard.writeText(url);
    toast.success("分享链接已复制");
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">我的</h1>
        <MainNav />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中...</div>
      ) : (
        <>
          {profile && (
            <div className="rounded-lg border p-4 space-y-4">
              <h2 className="font-medium">个人信息</h2>
              <div className="flex items-center gap-4">
                <img
                  src={profileAvatarPreview}
                  alt={profile.displayName}
                  className="w-14 h-14 rounded-full border"
                />
                <div className="grid md:grid-cols-2 gap-3 flex-1">
                  <div className="space-y-2">
                    <Label>昵称</Label>
                    <Input
                      value={profile.displayName}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, displayName: e.target.value } : prev))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>头像 URL</Label>
                    <Input
                      value={profile.avatarUrl || ""}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, avatarUrl: e.target.value || null } : prev))
                      }
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>保存个人信息</Button>
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-4">
            <h2 className="font-medium">新增 Skill 草稿</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>图标</Label>
                <Input
                  value={createDraft.icon}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, icon: e.target.value }))}
                  placeholder="🔧"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>描述</Label>
                <Input
                  value={createDraft.description}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>内容 (Markdown)</Label>
                <Textarea
                  className="min-h-[160px]"
                  value={createDraft.contentMarkdown}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({ ...prev, contentMarkdown: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button onClick={handleCreateSkill} disabled={saving}>创建草稿</Button>
          </div>

          <div className="space-y-3">
            <h2 className="font-medium">我的 Skills</h2>
            {skills.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无技能</div>
            ) : (
              skills.map((skill) => {
                const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${skill.shareSlug}`;
                const editing = editingSkillId === skill.id;

                return (
                  <div key={skill.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {skill.icon && <span>{skill.icon}</span>}
                          {skill.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          状态: {skill.status} · 更新时间: {new Date(skill.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleStartEdit(skill)}>
                          编辑
                        </Button>
                        <Button size="sm" onClick={() => handlePublishSkill(skill.id)} disabled={saving}>
                          发布/更新发布
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUnpublishSkill(skill.id)}
                          disabled={saving}
                        >
                          下架
                        </Button>
                      </div>
                    </div>

                    {skill.status === "published" && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2 break-all">
                        分享链接: {shareUrl}
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => copyShareLink(skill.shareSlug)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {editing && (
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>名称</Label>
                          <Input
                            value={editingDraft.name}
                            onChange={(e) =>
                              setEditingDraft((prev) => ({ ...prev, name: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>图标</Label>
                          <Input
                            value={editingDraft.icon}
                            onChange={(e) =>
                              setEditingDraft((prev) => ({ ...prev, icon: e.target.value }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label>描述</Label>
                          <Input
                            value={editingDraft.description}
                            onChange={(e) =>
                              setEditingDraft((prev) => ({ ...prev, description: e.target.value }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label>内容 (Markdown)</Label>
                          <Textarea
                            className="min-h-[140px]"
                            value={editingDraft.contentMarkdown}
                            onChange={(e) =>
                              setEditingDraft((prev) => ({ ...prev, contentMarkdown: e.target.value }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2 flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(skill.id)} disabled={saving}>保存</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSkillId(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
