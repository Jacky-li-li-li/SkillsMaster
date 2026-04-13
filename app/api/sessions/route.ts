import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

const CreateSessionSchema = z.object({
  skillId: z.string().cuid(),
});

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUserFromRequest(request);

    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            icon: true,
            status: true,
            shareSlug: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    });

    const groups = new Map<
      string,
      {
        skill: {
          id: string;
          name: string;
          icon: string | null;
          status: "draft" | "published" | "unpublished";
          shareSlug: string;
        };
        sessions: Array<{
          id: string;
          title: string;
          updatedAt: Date;
          createdAt: Date;
          lastMessagePreview: string | null;
          lastMessageAt: Date | null;
        }>;
      }
    >();

    for (const session of sessions) {
      if (!groups.has(session.skillId)) {
        groups.set(session.skillId, {
          skill: {
            id: session.skill.id,
            name: session.skill.name,
            icon: session.skill.icon,
            status: session.skill.status,
            shareSlug: session.skill.shareSlug,
          },
          sessions: [],
        });
      }

      const group = groups.get(session.skillId);
      if (!group) continue;

      const lastMessage = session.messages[0];
      group.sessions.push({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
        lastMessagePreview: lastMessage ? lastMessage.content.slice(0, 120) : null,
        lastMessageAt: lastMessage?.createdAt ?? null,
      });
    }

    return NextResponse.json({ groups: Array.from(groups.values()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findUnique({ where: { id: parsed.data.skillId } });
    if (!skill || skill.status !== "published") {
      return NextResponse.json(
        { error: "Skill is unavailable" },
        { status: 409 }
      );
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        skillId: skill.id,
        title: `与 ${skill.name} 的会话`,
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
