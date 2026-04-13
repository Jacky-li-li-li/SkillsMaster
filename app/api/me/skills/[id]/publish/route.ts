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

    const existing = await prisma.skill.findFirst({
      where: { id, authorId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const skill = await prisma.skill.update({
      where: { id: existing.id },
      data: {
        status: "published",
        publishedAt: existing.publishedAt ?? new Date(),
      },
    });

    return NextResponse.json({ skill });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
