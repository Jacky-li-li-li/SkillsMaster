import { z } from "zod";

// Skill 元数据 Schema
export const SkillMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  globs: z.array(z.string()).optional(),
  alwaysAllow: z.array(z.string()).optional(),
  icon: z.string().optional(),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

// 本地加载的 Skill
export interface LoadedSkill {
  slug: string;
  metadata: SkillMetadata;
  content: string;
  path: string;
  iconPath?: string;
  source: "local";
}

// Skill 创建/更新请求
export interface CreateSkillRequest {
  slug: string;
  name: string;
  description?: string;
  content: string;
  globs?: string[];
  alwaysAllow?: string[];
  icon?: string;
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  content?: string;
  globs?: string[];
  alwaysAllow?: string[];
  icon?: string;
}

// API 响应类型
export interface SkillsListResponse {
  skills: LoadedSkill[];
}

export interface SkillResponse {
  skill: LoadedSkill;
}

export interface SkillDeleteResponse {
  success: boolean;
  slug: string;
}
