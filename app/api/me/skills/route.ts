import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createShareSlug, slugify } from "@/lib/server/ids";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

const CreateSkillSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  contentMarkdown: z.string().trim().min(1).max(500_000),
  icon: z.string().trim().max(32).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUserFromRequest(request);

    const skills = await prisma.skill.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const body = await request.json();
    const parsed = CreateSkillSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(parsed.data.name);

    const skill = await prisma.skill.create({
      data: {
        authorId: user.id,
        name: parsed.data.name,
        slug: baseSlug,
        description: parsed.data.description,
        contentMarkdown: parsed.data.contentMarkdown,
        icon: parsed.data.icon,
        status: "draft",
        shareSlug: createShareSlug(baseSlug),
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
