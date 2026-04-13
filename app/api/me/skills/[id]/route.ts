import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

const UpdateSkillSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    contentMarkdown: z.string().trim().min(1).max(500_000).optional(),
    icon: z.string().trim().max(32).optional(),
    status: z.enum(["draft", "published", "unpublished"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedSkillOrNull(userId: string, id: string) {
  return prisma.skill.findFirst({ where: { id, authorId: userId } });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { id } = await params;

    const skill = await getOwnedSkillOrNull(user.id, id);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({ skill });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSkillSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const existing = await getOwnedSkillOrNull(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const skill = await prisma.skill.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        contentMarkdown: parsed.data.contentMarkdown,
        icon: parsed.data.icon,
        status: parsed.data.status,
        publishedAt:
          parsed.data.status === "published"
            ? existing.publishedAt ?? new Date()
            : parsed.data.status === "unpublished"
              ? null
              : undefined,
      },
    });

    return NextResponse.json({ skill });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { id } = await params;

    const existing = await getOwnedSkillOrNull(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const skill = await prisma.skill.update({
      where: { id: existing.id },
      data: {
        status: "unpublished",
      },
    });

    return NextResponse.json({ success: true, skill });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
