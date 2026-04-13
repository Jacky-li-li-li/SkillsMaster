import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateUserFromRequest } from "@/lib/server/local-user";

export async function GET(request: Request) {
  try {
    const currentUser = await getOrCreateUserFromRequest(request);

    const skills = await prisma.skill.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        likes: {
          where: { userId: currentUser.id },
          select: { userId: true },
        },
        _count: {
          select: { likes: true },
        },
      },
    });

    const result = skills.map((skill: (typeof skills)[number]) => ({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      icon: skill.icon,
      shareSlug: skill.shareSlug,
      updatedAt: skill.updatedAt,
      author: skill.author,
      likeCount: skill._count.likes,
      likedByMe: skill.likes.length > 0,
    }));

    return NextResponse.json({ skills: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
