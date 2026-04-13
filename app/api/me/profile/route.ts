import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  getLocalClientIdFromRequest,
  getOrCreateUserFromRequest,
} from "@/lib/server/local-user";

const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  avatarUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUserFromRequest(request);
    return NextResponse.json({ profile: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const localClientId = getLocalClientIdFromRequest(request);
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: { localClientId },
      update: {
        displayName: parsed.data.displayName,
        avatarUrl: parsed.data.avatarUrl || null,
      },
      create: {
        localClientId,
        displayName: parsed.data.displayName,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    return NextResponse.json({ profile: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
