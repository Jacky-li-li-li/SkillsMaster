import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

interface RouteParams {
  params: Promise<{ shareSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { shareSlug } = await params;

    const skill = await prisma.skill.findUnique({
      where: { shareSlug },
      select: { id: true, name: true, status: true },
    });

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    if (skill.status !== "published") {
      return NextResponse.json(
        { error: "该 skill 已下架或删除，无法开启新会话" },
        { status: 409 }
      );
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        skillId: skill.id,
        title: `与 ${skill.name} 的会话`,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
