import { NextResponse } from "next/server";
import { createSkill, skillExists } from "@/lib/skills/storage";
import { parseSkillMd } from "@/lib/skills/parser";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";

const execFileAsync = promisify(execFile);

interface RouteParams {
  params: Promise<{ slug: string[] }>;
}

const GITHUB_SEGMENT_REGEX = /^[A-Za-z0-9_.-]+$/;
const SKILL_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (slug.length !== 3) {
    return NextResponse.json(
      { error: "Invalid skill path format. Expected: owner/repo/skill-name" },
      { status: 400 }
    );
  }

  const [owner, repo, skillName] = slug;
  if (
    !GITHUB_SEGMENT_REGEX.test(owner) ||
    !GITHUB_SEGMENT_REGEX.test(repo) ||
    !SKILL_NAME_REGEX.test(skillName)
  ) {
    return NextResponse.json(
      { error: "Invalid owner/repo/skill name format" },
      { status: 400 }
    );
  }

  if (skillExists(skillName)) {
    return NextResponse.json(
      { error: `Skill "${skillName}" already exists` },
      { status: 409 }
    );
  }

  try {
    const githubUrl = `https://github.com/${owner}/${repo}`;
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["skills", "add", githubUrl, "--skill", skillName],
      {
        cwd: process.cwd(),
        timeout: 120_000,
      }
    );

    console.log(`Install output for ${owner}/${repo}/${skillName}: ${stdout}`);
    if (stderr) {
      console.error(`Install stderr: ${stderr}`);
    }

    const skillsDir = resolve(homedir(), ".skills", owner, repo, skillName);
    const skillFile = join(skillsDir, "SKILL.md");

    console.log(`Reading skill from: ${skillFile}`);
    const rawSkillMd = await readFile(skillFile, "utf-8");
    const parsed = parseSkillMd(rawSkillMd);
    if (!parsed) {
      throw new Error("Installed SKILL.md metadata is invalid");
    }

    const skill = createSkill({
      slug: skillName,
      name: parsed.metadata.name,
      description: parsed.metadata.description ?? `Installed from ${owner}/${repo}`,
      content: parsed.content,
      globs: parsed.metadata.globs,
      alwaysAllow: parsed.metadata.alwaysAllow,
      icon: parsed.metadata.icon,
    });

    return NextResponse.json({ skill, source: "registry" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Installation error:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
