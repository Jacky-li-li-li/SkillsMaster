import { NextResponse } from "next/server";
import { loadSkill, updateSkill, deleteSkill } from "@/lib/skills/storage";
import { isValidSkillSlug } from "@/lib/skills/slug";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const UpdateSkillRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    content: z.string().trim().min(1).max(200_000).optional(),
    globs: z.array(z.string().max(256)).max(100).optional(),
    alwaysAllow: z.array(z.string().max(128)).max(100).optional(),
    icon: z.string().max(16).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!isValidSkillSlug(slug)) {
    return NextResponse.json({ error: "Invalid skill slug" }, { status: 400 });
  }

  const skill = loadSkill(slug);

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json({ skill });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!isValidSkillSlug(slug)) {
    return NextResponse.json({ error: "Invalid skill slug" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateSkillRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const skill = updateSkill(slug, parsed.data);
    return NextResponse.json({ skill });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!isValidSkillSlug(slug)) {
    return NextResponse.json({ error: "Invalid skill slug" }, { status: 400 });
  }

  const success = deleteSkill(slug);

  if (!success) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, slug });
}
