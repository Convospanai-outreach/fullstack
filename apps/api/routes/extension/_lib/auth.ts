import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export type ExtensionAuthFailureCode =
  | "MISSING_EXTENSION_KEY"
  | "INVALID_EXTENSION_KEY"
  | "MISSING_TOKEN"
  | "LEGACY_IDENTITY_DISABLED"
  | "INVALID_TOKEN"
  | "USER_NOT_FOUND";

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
      code: ExtensionAuthFailureCode;
      error: string;
    };

function isLegacyFallbackEnabled(): boolean {
  // Backward compatibility is allowed only in non-production when explicitly opted in.
  return process.env.NODE_ENV !== "production" && process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"] === "true";
}

function failure(status: number, code: ExtensionAuthFailureCode, error: string): ExtensionAuthResult {
  return { ok: false, status, code, error };
}

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
  const allowLegacyFallbacks = isLegacyFallbackEnabled();
  const explicitUserId = req.headers.get("x-user-id")?.trim();
  const token = readAuthToken(req);
  const isBearerToken = req.headers.get("authorization")?.trim().toLowerCase().startsWith("bearer ") ?? false;

  if (allowLegacyFallbacks && explicitUserId) {
    const directUser = await prisma.user.findUnique({
      where: { id: explicitUserId },
      select: { id: true },
    });
    if (directUser?.id) return directUser.id;
  }

  if (!token) {
    return null;
  }

  // Production accepts only opaque, expiring tokens minted via
  // POST /api/extension/token (apps/web, Clerk-authenticated), stored as Session rows.
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true, expires: true },
  });
  if (session?.userId && session.expires > new Date()) {
    return session.userId;
  }

  if (!allowLegacyFallbacks) {
    return null;
  }

  // In non-production we only allow legacy direct-id token fallback for non-bearer tokens.
  if (isBearerToken) {
    return null;
  }

  const directUser = await prisma.user.findUnique({
    where: { id: token },
    select: { id: true },
  });
  return directUser?.id ?? null;
}

export async function validateExtensionAuth(req: NextRequest): Promise<ExtensionAuthResult> {
  const requiredKey = process.env["EXTENSION_API_KEY"];
  const providedKey = req.headers.get("x-extension-key");
  if (!requiredKey || providedKey !== requiredKey) {
    return requiredKey
      ? failure(401, "INVALID_EXTENSION_KEY", "Invalid extension key")
      : failure(401, "MISSING_EXTENSION_KEY", "Extension key is not configured");
  }

  const rawAuth = req.headers.get("authorization");
  const allowLegacyFallbacks = isLegacyFallbackEnabled();
  const explicitUserId = req.headers.get("x-user-id")?.trim();
  const hasToken = Boolean(rawAuth?.trim());

  if (!hasToken && !(allowLegacyFallbacks && explicitUserId)) {
    return failure(401, "MISSING_TOKEN", "Missing authorization token");
  }

  const isBearerToken = rawAuth?.trim().toLowerCase().startsWith("bearer ") ?? false;
  if (!allowLegacyFallbacks && !isBearerToken) {
    return failure(401, "LEGACY_IDENTITY_DISABLED", "Legacy identity fallback is disabled in production");
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    const bearerInRequest = rawAuth?.trim().toLowerCase().startsWith("bearer ") ?? false;
    if (!hasToken && allowLegacyFallbacks && explicitUserId) {
      return failure(401, "USER_NOT_FOUND", "User not found");
    }
    return failure(
      401,
      allowLegacyFallbacks || bearerInRequest ? "INVALID_TOKEN" : "LEGACY_IDENTITY_DISABLED",
      allowLegacyFallbacks || bearerInRequest ? "Invalid authorization token" : "Legacy identity fallback is disabled in production"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: { where: { status: "active" }, select: { teamId: true } },
    },
  });

  if (!user) {
    return failure(401, "USER_NOT_FOUND", "User not found");
  }

  const teamIds = Array.from(new Set(user.memberships.map((m) => m.teamId).filter(Boolean)));
  return { ok: true, user, teamIds };
}
