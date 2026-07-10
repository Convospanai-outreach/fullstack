import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  API_KEY_AUTH_RATE_LIMIT,
  LEGACY_API_KEY_RETIREMENT_DATE,
  constantTimeEquals,
  createApiKeyLookup,
  getApiKeyAuthRateLimitIdentifier,
  hasRequiredApiKeyScope,
  isValidPresentedApiKey,
} from "@/lib/apiKeySecurity";

export type ApiKeyAuthContext = {
  teamId: string;
  scopes: string[];
  keyId: string;
};

export async function validateApiKey(
  req: NextRequest,
  requiredScope?: string
): Promise<ApiKeyAuthContext | null> {
  const presentedKey = req.headers.get("x-api-key");
  if (!presentedKey || !isValidPresentedApiKey(presentedKey)) {
    return null;
  }

  try {
    const rateLimit = await checkRateLimit(
      getApiKeyAuthRateLimitIdentifier(presentedKey),
      API_KEY_AUTH_RATE_LIMIT,
      "api-key-auth"
    );
    if (!rateLimit.allowed) {
      return null;
    }
  } catch {
    // Fail closed without logging the presented secret.
    return null;
  }

  const lookup = createApiKeyLookup(presentedKey);
  let keyRecord = await prisma.apiKey.findUnique({
    where: { key: lookup },
  });
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

  if (!hasRequiredApiKeyScope(keyRecord.scopes, requiredScope, legacyKey, now)) {
    return null;
  }

  if (legacyKey) {
    const upgraded = await prisma.apiKey.updateMany({
      where: {
        id: keyRecord.id,
        key: presentedKey,
        isActive: true,
      },
      data: {
        key: lookup,
      },
    });

    if (upgraded.count !== 1) {
      return null;
    }
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
