import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

type ExtensionAuthResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string | null;
        memberships: Array<{ teamId: string }>;
      };
      teamIds: string[];
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function readAuthToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed || null;
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const explicitUserId = req.headers.get("x-user-id")?.trim();
  if (explicitUserId) return explicitUserId;

  const token = readAuthToken(req);
  if (!token) return null;

  // Backward compatible path: token is the user id.
  const directUser = await prisma.user.findUnique({
    where: { id: token },
    select: { id: true },
  });
  if (directUser?.id) return directUser.id;

  // Hosted path: token is a NextAuth session token.
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true },
  });
  return session?.userId || null;
}

export async function validateExtensionAuth(req: NextRequest): Promise<ExtensionAuthResult> {
  const requiredKey = process.env["EXTENSION_API_KEY"];
  const providedKey = req.headers.get("x-extension-key");
  if (!requiredKey || providedKey !== requiredKey) {
    return { ok: false, status: 401, error: "Unauthorized extension key" };
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    return { ok: false, status: 401, error: "Missing or invalid token" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: { select: { teamId: true } },
    },
  });

  if (!user) {
    return { ok: false, status: 401, error: "User not found" };
  }

  const teamIds = Array.from(new Set(user.memberships.map((m) => m.teamId).filter(Boolean)));
  return { ok: true, user, teamIds };
}

