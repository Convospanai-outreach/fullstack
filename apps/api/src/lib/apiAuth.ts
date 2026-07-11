import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiKeyLookupValues } from "@/lib/apiKeySecurity";

const FAILED_AUTH_WINDOW_MS = 60 * 1000;
const FAILED_AUTH_MAX_ATTEMPTS = 10;

type FailedAuthBucket = {
    count: number;
    resetAt: number;
};

const failedAuthBuckets = new Map<string, FailedAuthBucket>();

export type ApiKeyAuthContext = {
    keyId: string;
    teamId: string;
    scopes: string[];
};

export type ApiKeyAuthResult =
    | { ok: true; context: ApiKeyAuthContext }
    | { ok: false; response: NextResponse };

function hashIdentifier(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function getRequesterSource(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || req.headers.get("cf-connecting-ip")
        || "unknown"
    );
}

function getFailedAuthBucketKey(req: NextRequest): string {
    const endpoint = new URL(req.url).pathname;
    return `${endpoint}:${hashIdentifier(getRequesterSource(req))}`;
}

function recordFailedApiKeyAuth(req: NextRequest): NextResponse {
    const now = Date.now();
    const key = getFailedAuthBucketKey(req);
    const existing = failedAuthBuckets.get(key);
    const bucket = !existing || now > existing.resetAt
        ? { count: 1, resetAt: now + FAILED_AUTH_WINDOW_MS }
        : { count: existing.count + 1, resetAt: existing.resetAt };

    failedAuthBuckets.set(key, bucket);

    if (bucket.count > FAILED_AUTH_MAX_ATTEMPTS) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        return NextResponse.json(
            { error: "Too many failed API key attempts" },
            {
                status: 429,
                headers: { "Retry-After": retryAfter.toString() },
            }
        );
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function resetApiKeyAuthRateLimitForTests() {
    failedAuthBuckets.clear();
}

export async function authorizeApiKey(req: NextRequest, requiredScope?: string): Promise<ApiKeyAuthResult> {
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
        return { ok: false, response: recordFailedApiKeyAuth(req) };
    }

    const lookupValues = getApiKeyLookupValues(apiKey);
    if (lookupValues.length === 0) {
        return { ok: false, response: recordFailedApiKeyAuth(req) };
    }

    const keyRecord = await prisma.apiKey.findFirst({
        where: { key: { in: lookupValues } }
    });

    if (!keyRecord || !keyRecord.isActive) {
        return { ok: false, response: recordFailedApiKeyAuth(req) };
    }

    if (requiredScope && !keyRecord.scopes.includes(requiredScope)) {
        return { ok: false, response: recordFailedApiKeyAuth(req) };
    }

    // Async update last used (non-blocking)
    prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() }
    }).catch(console.error);

    return {
        ok: true,
        context: {
            keyId: keyRecord.id,
            teamId: keyRecord.teamId,
            scopes: keyRecord.scopes
        }
    };
}

export async function validateApiKey(req: NextRequest, requiredScope?: string) {
    const result = await authorizeApiKey(req, requiredScope);
    return result.ok ? result.context : null;
}
