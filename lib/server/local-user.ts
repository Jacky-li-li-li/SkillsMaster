import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const LOCAL_CLIENT_ID_HEADER = "x-local-client-id";

function fallbackDisplayName(clientId: string): string {
  return `用户-${clientId.slice(0, 6)}`;
}

function fallbackAvatar(clientId: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(clientId)}`;
}

export function getLocalClientIdFromRequest(request: Request): string {
  const clientId = request.headers.get(LOCAL_CLIENT_ID_HEADER)?.trim();
  if (!clientId) {
    throw new Error("Missing local client id");
  }
  return clientId;
}

export async function getOrCreateUserByLocalClientId(localClientId: string): Promise<User> {
  return prisma.user.upsert({
    where: { localClientId },
    update: {},
    create: {
      localClientId,
      displayName: fallbackDisplayName(localClientId || randomUUID()),
      avatarUrl: fallbackAvatar(localClientId),
    },
  });
}

export async function getOrCreateUserFromRequest(request: Request): Promise<User> {
  const localClientId = getLocalClientIdFromRequest(request);
  return getOrCreateUserByLocalClientId(localClientId);
}
