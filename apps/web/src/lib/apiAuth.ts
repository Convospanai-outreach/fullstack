import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

const API_KEY_SCOPES = new Set([
  "agents:read",
  "agents:write",
  "campaigns:read",
  "campaigns:write",
  "leads:read",
  "leads:write",
  "tasks:read",
  "tasks:write",
  "workflows:read",
  "workflows:write",
  "workflows:run",
]);
const LEGACY_API_KEY_RETIREMENT_DATE = new Date("2026-10-31T00:00:00.000Z");
const NEW_KEY_PATTERN = /^cmf_live_[a-f0-9]{64}$/;
const LEGACY_KEY_PATTERN = /^(?:cs|sk)_live_[a-f0-9]{48}$/;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEquals(left: string, right: string) {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest()
  );
}

function isValidPresentedApiKey(value: string) {
  return NEW_KEY_PATTERN.test(value) || LEGACY_KEY_PATTERN.test(value);
}

function createApiKeyLookup(rawKey: string) {
  return `v2:${sha256(rawKey)}:${rawKey.slice(-4).toLowerCase()}`;
}

function hasRequiredScope(
  scopes: string[],
  requiredScope: string | undefined,
  legacyKey: boolean,
  now: Date
) {
  if (!requiredScope) return true;
  if (!API_KEY_SCOPES.has(requiredScope)) return false;
  if (scopes.includes(requiredScope)) return true;
  return legacyKey && now < LEGACY_API_KEY_RETIREMENT_DATE && scopes.includes("admin");
}

export async function validateApiKey(req: NextRequest, requiredScope?: string) {
  const presentedKey = req.headers.get("x-api-key");
  if (!presentedKey || !isValidPresentedApiKey(presentedKey)) {
    return null;
  }

  try {
    const rateLimit = await checkRateLimit(
      `api-key-auth:${sha256(presentedKey)}`,
      { windowMs: 60_000, maxRequests: 60 },
      "api-key-auth"
    );
    if (!rateLimit.allowed) return null;
  } catch {
    return null;
  }

  const lookup = createApiKeyLookup(presentedKey);
  let keyRecord = await prisma.apiKey.findUnique({ where: { key: lookup } });
  let legacyKey = false;

  if (keyRecord && !constantTimeEquals(keyRecord.key, lookup)) {
    keyRecord = null;
  }

  if (!keyRecord) {
    const legacyRecord = await prisma.apiKey.findUnique({
      where: { key: presentedKey },
    });
    if (!legacyRecord || !constantTimeEquals(legacyRecord.key, presentedKey)) {
      return null;
    }
    keyRecord = legacyRecord;
    legacyKey = true;
  }

  if (!keyRecord || !keyRecord.isActive) {
    return null;
  }

  const now = new Date();
  if (legacyKey && now >= LEGACY_API_KEY_RETIREMENT_DATE) {
    return null;
  }

  if (!hasRequiredScope(keyRecord.scopes, requiredScope, legacyKey, now)) {
    return null;
  }

  if (legacyKey) {
    const upgraded = await prisma.apiKey.updateMany({
      where: { id: keyRecord.id, key: presentedKey, isActive: true },
      data: { key: lookup },
    });
    if (upgraded.count !== 1) return null;
  }

  void prisma.apiKey.updateMany({
    where: { id: keyRecord.id, isActive: true },
    data: { lastUsedAt: now },
  }).catch(() => {
    logger.warn("[ApiKeyAuth] Unable to update key usage metadata", {
      apiKeyId: keyRecord.id,
    });
  });

  return {
    teamId: keyRecord.teamId,
    scopes: keyRecord.scopes,
    keyId: keyRecord.id,
  };
}
