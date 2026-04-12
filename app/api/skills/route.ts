import { NextResponse } from "next/server";
import { loadAllSkills, createSkill } from "@/lib/skills/storage";
import type { CreateSkillRequest } from "@/lib/skills/types";
import { z } from "zod";

const CreateSkillRequestSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "slug must contain lowercase letters, numbers, and hyphens only",
    }),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  content: z.string().trim().min(1).max(200_000),
  globs: z.array(z.string().max(256)).max(100).optional(),
  alwaysAllow: z.array(z.string().max(128)).max(100).optional(),
  icon: z.string().max(16).optional(),
});

export async function GET() {
  try {
    const skills = loadAllSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSkillRequest;
    const parsed = CreateSkillRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const skill = createSkill(parsed.data);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
