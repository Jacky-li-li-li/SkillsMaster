import fs from "fs";
import path from "path";
import os from "os";
import type { LoadedSkill, CreateSkillRequest, UpdateSkillRequest } from "./types";
import { parseSkillMd, serializeSkillMd } from "./parser";
import { assertValidSkillSlug, isValidSkillSlug } from "./slug";

const PROJECT_SKILLS_BASE_DIR = path.resolve(process.cwd(), ".claude", "skills");
const USER_SKILLS_BASE_DIR = path.resolve(os.homedir(), ".claude", "skills");

type SkillScope = "project" | "user";

interface SkillLocation {
  scope: SkillScope;
  baseDir: string;
}

const SKILL_LOCATIONS: SkillLocation[] = [
  { scope: "project", baseDir: PROJECT_SKILLS_BASE_DIR },
  { scope: "user", baseDir: USER_SKILLS_BASE_DIR },
];

function ensureSkillsDir(scope: SkillScope = "project"): string {
  const baseDir =
    scope === "project" ? PROJECT_SKILLS_BASE_DIR : USER_SKILLS_BASE_DIR;

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

function getSkillDir(baseDir: string, slug: string): string {
  assertValidSkillSlug(slug);
  const skillDir = path.resolve(baseDir, slug);

  if (skillDir !== baseDir && !skillDir.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Invalid skill path");
  }

  return skillDir;
}

function getSkillMdPath(baseDir: string, slug: string): string {
  return path.join(getSkillDir(baseDir, slug), "SKILL.md");
}

function findSkillLocation(slug: string): SkillLocation | null {
  for (const location of SKILL_LOCATIONS) {
    if (fs.existsSync(getSkillMdPath(location.baseDir, slug))) {
      return location;
    }
  }
  return null;
}

function listSkillSlugsFromBase(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => isValidSkillSlug(entry.name))
      .filter((entry) => fs.existsSync(path.join(baseDir, entry.name, "SKILL.md")))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function loadSkillFromLocation(
  slug: string,
  location: SkillLocation
): LoadedSkill | null {
  const skillMdPath = getSkillMdPath(location.baseDir, slug);
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, "utf-8");
    const parsed = parseSkillMd(content);
    if (!parsed) {
      return null;
    }

    const skillDir = getSkillDir(location.baseDir, slug);
    let iconPath: string | undefined;

    const iconExtensions = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
    for (const ext of iconExtensions) {
      const iconFile = path.join(skillDir, `icon${ext}`);
      if (fs.existsSync(iconFile)) {
        iconPath = iconFile;
        break;
      }
    }

    return {
      slug,
      metadata: parsed.metadata,
      content: parsed.content,
      path: skillDir,
      iconPath,
      source: "local",
    };
  } catch (error) {
    console.error(`Failed to load skill ${slug}:`, error);
    return null;
  }
}

export function skillExists(slug: string): boolean {
  if (!isValidSkillSlug(slug)) {
    return false;
  }

  return findSkillLocation(slug) !== null;
}

export function listSkillSlugs(): string[] {
  const slugs = new Set<string>();

  for (const location of SKILL_LOCATIONS) {
    for (const slug of listSkillSlugsFromBase(location.baseDir)) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}

export function loadSkill(slug: string): LoadedSkill | null {
  if (!isValidSkillSlug(slug)) {
    return null;
  }

  const location = findSkillLocation(slug);
  if (!location) {
    return null;
  }

  return loadSkillFromLocation(slug, location);
}

export function loadAllSkills(): LoadedSkill[] {
  const slugs = listSkillSlugs();
  const skills: LoadedSkill[] = [];

  for (const slug of slugs) {
    const skill = loadSkill(slug);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

export function createSkill(request: CreateSkillRequest): LoadedSkill {
  const baseDir = ensureSkillsDir("project");
  assertValidSkillSlug(request.slug);

  if (skillExists(request.slug)) {
    throw new Error(`Skill "${request.slug}" already exists`);
  }

  const skillDir = getSkillDir(baseDir, request.slug);
  fs.mkdirSync(skillDir, { recursive: true });

  const metadata = {
    name: request.name,
    description: request.description,
    globs: request.globs,
    alwaysAllow: request.alwaysAllow,
    icon: request.icon,
  };

  const skillMdContent = serializeSkillMd(metadata, request.content);
  fs.writeFileSync(getSkillMdPath(baseDir, request.slug), skillMdContent, "utf-8");

  return {
    slug: request.slug,
    metadata,
    content: request.content,
    path: skillDir,
    source: "local",
  };
}

export function updateSkill(slug: string, request: UpdateSkillRequest): LoadedSkill {
  assertValidSkillSlug(slug);
  const existing = loadSkill(slug);
  if (!existing) {
    throw new Error(`Skill "${slug}" not found`);
  }

  const metadata = {
    name: request.name ?? existing.metadata.name,
    description: request.description ?? existing.metadata.description,
    globs: request.globs ?? existing.metadata.globs,
    alwaysAllow: request.alwaysAllow ?? existing.metadata.alwaysAllow,
    icon: request.icon ?? existing.metadata.icon,
  };

  const content = request.content ?? existing.content;
  const skillMdContent = serializeSkillMd(metadata, content);
  fs.writeFileSync(path.join(existing.path, "SKILL.md"), skillMdContent, "utf-8");

  return {
    slug,
    metadata,
    content,
    path: existing.path,
    iconPath: existing.iconPath,
    source: "local",
  };
}

export function deleteSkill(slug: string): boolean {
  if (!isValidSkillSlug(slug)) {
    return false;
  }

  const location = findSkillLocation(slug);
  if (!location) {
    return false;
  }

  const skillDir = getSkillDir(location.baseDir, slug);
  fs.rmSync(skillDir, { recursive: true, force: true });
  return true;
}
