import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import matter from "gray-matter";

export interface SessionRuntimeSkill {
  name: string;
  description: string | null;
  contentMarkdown: string;
  icon: string | null;
}

export async function prepareSessionRuntimeSkill(
  sessionId: string,
  skill: SessionRuntimeSkill
): Promise<{ cwd: string; expectedSkillName: string }> {
  const runtimeRoot = path.resolve(process.cwd(), ".runtime", "sessions", sessionId);
  const skillsRoot = path.join(runtimeRoot, ".claude", "skills");
  const activeSkillDir = path.join(skillsRoot, "active");
  const skillFilePath = path.join(activeSkillDir, "SKILL.md");

  await rm(skillsRoot, { recursive: true, force: true });
  await mkdir(activeSkillDir, { recursive: true });

  const expectedSkillName = "active";
  const frontmatter: Record<string, unknown> = {
    name: expectedSkillName,
  };

  if (skill.description) {
    frontmatter.description = skill.description;
  }
  if (skill.icon) {
    frontmatter.icon = skill.icon;
  }

  const content = matter.stringify(skill.contentMarkdown, frontmatter);
  await writeFile(skillFilePath, content, "utf-8");

  return { cwd: runtimeRoot, expectedSkillName };
}
