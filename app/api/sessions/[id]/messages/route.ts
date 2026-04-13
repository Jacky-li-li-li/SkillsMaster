import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    const { id } = await params;

    const session = await prisma.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = session.messages.map((item: (typeof session.messages)[number]) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      toolCalls: item.toolCallsJson,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        skill: session.skill,
      },
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
