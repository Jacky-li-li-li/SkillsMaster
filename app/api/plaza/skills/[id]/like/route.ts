import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { id } = await params;

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill || skill.status !== "published") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const existing = await prisma.skillLike.findUnique({
      where: {
        userId_skillId: {
          userId: user.id,
          skillId: skill.id,
        },
      },
    });

    if (existing) {
      await prisma.skillLike.delete({
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: skill.id,
          },
        },
      });
    } else {
      await prisma.skillLike.create({
        data: {
          userId: user.id,
          skillId: skill.id,
        },
      });
    }

    const likeCount = await prisma.skillLike.count({ where: { skillId: skill.id } });

    return NextResponse.json({
      likedByMe: !existing,
      likeCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
