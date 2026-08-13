import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
    type ApiKeyScope,
    createUpgradedLegacyApiKeyValue,
    getApiKeyLookupValues,
    isValidLegacyApiKeyFormat,
} from "@/lib/apiKeySecurity";

const FAILED_AUTH_WINDOW_MS = 60 * 1000;
const FAILED_AUTH_MAX_ATTEMPTS = 10;
const FAILED_AUTH_GLOBAL_MAX_ATTEMPTS = 200;
const FAILED_AUTH_MAX_BUCKETS = 1000;
// Per-key ceiling on successful auth, independent of the failed-auth throttle above. Note this
// stacks under the existing per-team 100/min limit in v1 routes (apps/api/src/lib/apiRateLimit.ts)
// - a single-key team's effective ceiling on those routes is 60/min, not 100/min.
const KEY_AUTH_SUCCESS_WINDOW_MS = 60 * 1000;
const KEY_AUTH_SUCCESS_MAX_REQUESTS = 60;
const KEY_AUTH_SUCCESS_MAX_BUCKETS = 1000;
export const API_KEY_REQUEST_SOURCE_HEADER = "x-cmf-request-source";

type ApiKeyRoutePolicy = {
    method: string;
    route: string;
    family: string;
    requiredScope: ApiKeyScope | null;
    authMode: "apiKey" | "public";
    throttleFamily: string;
};

export const API_KEY_ROUTE_POLICIES: readonly ApiKeyRoutePolicy[] = [
    { method: "GET", route: "/v1/system/health", family: "v1.system.health", requiredScope: null, authMode: "public", throttleFamily: "v1.system.health" },
    { method: "GET", route: "/v1/campaigns", family: "v1.campaigns", requiredScope: "campaigns:read", authMode: "apiKey", throttleFamily: "v1.campaigns" },
    { method: "POST", route: "/v1/intelligence/sync", family: "v1.intelligence.sync", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.intelligence.sync" },
    { method: "GET", route: "/v1/knowledge", family: "v1.knowledge", requiredScope: "leads:read", authMode: "apiKey", throttleFamily: "v1.knowledge" },
    { method: "POST", route: "/v1/knowledge", family: "v1.knowledge", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.knowledge" },
    { method: "GET", route: "/v1/leads", family: "v1.leads", requiredScope: "leads:read", authMode: "apiKey", throttleFamily: "v1.leads" },
    { method: "POST", route: "/v1/leads", family: "v1.leads", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.leads" },
    { method: "GET", route: "/v1/leads/[id]", family: "v1.leads.item", requiredScope: "leads:read", authMode: "apiKey", throttleFamily: "v1.leads.item" },
    { method: "PATCH", route: "/v1/leads/[id]", family: "v1.leads.item", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.leads.item" },
    { method: "DELETE", route: "/v1/leads/[id]", family: "v1.leads.item", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.leads.item" },
    { method: "GET", route: "/v1/leads/[id]/messages", family: "v1.leads.messages", requiredScope: "leads:read", authMode: "apiKey", throttleFamily: "v1.leads.messages" },
    { method: "POST", route: "/v1/leads/[id]/messages", family: "v1.leads.messages", requiredScope: "leads:write", authMode: "apiKey", throttleFamily: "v1.leads.messages" },
    { method: "GET", route: "/v1/tasks", family: "v1.tasks", requiredScope: "tasks:read", authMode: "apiKey", throttleFamily: "v1.tasks" },
    { method: "POST", route: "/v1/tasks", family: "v1.tasks", requiredScope: "tasks:write", authMode: "apiKey", throttleFamily: "v1.tasks" },
    { method: "GET", route: "/v1/workflows", family: "v1.workflows", requiredScope: "workflows:read", authMode: "apiKey", throttleFamily: "v1.workflows" },
    { method: "POST", route: "/v1/workflows", family: "v1.workflows", requiredScope: "workflows:write", authMode: "apiKey", throttleFamily: "v1.workflows" },
    { method: "POST", route: "/v1/workflows/[id]/run", family: "v1.workflows.run", requiredScope: "workflows:run", authMode: "apiKey", throttleFamily: "v1.workflows.run" },
];

type FailedAuthBucket = {
    count: number;
    resetAt: number;
};

const failedAuthBuckets = new Map<string, FailedAuthBucket>();
let globalFailedAuthBucket: FailedAuthBucket | null = null;

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

function normalizeRequestPath(pathname: string): string {
    return pathname.startsWith("/api/v1/") ? pathname.slice(4) : pathname;
}

function routePolicyMatches(policy: ApiKeyRoutePolicy, method: string, pathname: string): boolean {
    if (policy.method !== method.toUpperCase()) return false;
    const escaped = policy.route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = `^${escaped.replace(/\\\[([^\\\]]+)\\\]/g, "[^/]+")}$`;
    return new RegExp(pattern).test(normalizeRequestPath(pathname));
}

export function getApiKeyRoutePolicy(method: string, registeredPath: string): ApiKeyRoutePolicy | null {
    return API_KEY_ROUTE_POLICIES.find(policy => (
        policy.method === method.toUpperCase() && policy.route === registeredPath
    )) ?? null;
}

function getApiKeyRoutePolicyForRequest(req: NextRequest): ApiKeyRoutePolicy | null {
    const pathname = new URL(req.url).pathname;
    return API_KEY_ROUTE_POLICIES.find(policy => routePolicyMatches(policy, req.method, pathname)) ?? null;
}

function getRequesterSource(req: NextRequest): string {
    return req.headers.get(API_KEY_REQUEST_SOURCE_HEADER) || "server-source-unavailable";
}

function getFailedAuthBucketKey(req: NextRequest): string {
    const policy = getApiKeyRoutePolicyForRequest(req);
    const family = policy?.throttleFamily || "unregistered";
    return `${family}:${hashIdentifier(getRequesterSource(req))}`;
}

function pruneExpiredFailedAuthBuckets(now: number) {
    for (const [key, bucket] of failedAuthBuckets.entries()) {
        if (now > bucket.resetAt) failedAuthBuckets.delete(key);
    }
    if (globalFailedAuthBucket && now > globalFailedAuthBucket.resetAt) {
        globalFailedAuthBucket = null;
    }
}

function enforceFailedAuthBucketBound() {
    while (failedAuthBuckets.size > FAILED_AUTH_MAX_BUCKETS) {
        const oldestKey = failedAuthBuckets.keys().next().value;
        if (!oldestKey) return;
        failedAuthBuckets.delete(oldestKey);
    }
}

function toThrottleResponse(message: string, bucket: FailedAuthBucket, now: number): NextResponse {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
        { error: message },
        {
            status: 429,
            headers: { "Retry-After": retryAfter.toString() },
        }
    );
}

function toFailedAuthThrottleResponse(bucket: FailedAuthBucket, now: number): NextResponse {
    return toThrottleResponse("Too many failed API key attempts", bucket, now);
}

const keyAuthSuccessBuckets = new Map<string, FailedAuthBucket>();

function pruneExpiredKeyAuthSuccessBuckets(now: number) {
    for (const [key, bucket] of keyAuthSuccessBuckets.entries()) {
        if (now > bucket.resetAt) keyAuthSuccessBuckets.delete(key);
    }
}

function enforceKeyAuthSuccessBucketBound() {
    while (keyAuthSuccessBuckets.size > KEY_AUTH_SUCCESS_MAX_BUCKETS) {
        const oldestKey = keyAuthSuccessBuckets.keys().next().value;
        if (!oldestKey) return;
        keyAuthSuccessBuckets.delete(oldestKey);
    }
}

// Rate-limits successful auth per key (by DB id, so both legacy lookup forms of the same
// row share one bucket), not per source - distinct from the failed-auth throttle above.
function checkKeyAuthSuccessThrottle(keyId: string): NextResponse | null {
    const now = Date.now();
    pruneExpiredKeyAuthSuccessBuckets(now);

    const existing = keyAuthSuccessBuckets.get(keyId);
    const bucket = !existing || now > existing.resetAt
        ? { count: 1, resetAt: now + KEY_AUTH_SUCCESS_WINDOW_MS }
        : { count: existing.count + 1, resetAt: existing.resetAt };

    keyAuthSuccessBuckets.set(keyId, bucket);
    enforceKeyAuthSuccessBucketBound();

    if (bucket.count > KEY_AUTH_SUCCESS_MAX_REQUESTS) {
        return toThrottleResponse("Too many requests for this API key", bucket, now);
    }
    return null;
}

function getFailedApiKeyAuthThrottleResponse(req: NextRequest): NextResponse | null {
    const now = Date.now();
    pruneExpiredFailedAuthBuckets(now);

    const key = getFailedAuthBucketKey(req);
    const bucket = failedAuthBuckets.get(key);
    if (bucket && bucket.count >= FAILED_AUTH_MAX_ATTEMPTS) {
        return toFailedAuthThrottleResponse(bucket, now);
    }
    return null;
}

function recordFailedApiKeyAuth(req: NextRequest): NextResponse {
    const now = Date.now();
    pruneExpiredFailedAuthBuckets(now);

    const key = getFailedAuthBucketKey(req);
    const existing = failedAuthBuckets.get(key);
    const bucket = !existing || now > existing.resetAt
        ? { count: 1, resetAt: now + FAILED_AUTH_WINDOW_MS }
        : { count: existing.count + 1, resetAt: existing.resetAt };

    failedAuthBuckets.set(key, bucket);
    globalFailedAuthBucket = !globalFailedAuthBucket || now > globalFailedAuthBucket.resetAt
        ? { count: 1, resetAt: now + FAILED_AUTH_WINDOW_MS }
        : { count: globalFailedAuthBucket.count + 1, resetAt: globalFailedAuthBucket.resetAt };
    enforceFailedAuthBucketBound();

    if (bucket.count > FAILED_AUTH_MAX_ATTEMPTS) {
        return toFailedAuthThrottleResponse(bucket, now);
    }

    if (globalFailedAuthBucket.count > FAILED_AUTH_GLOBAL_MAX_ATTEMPTS) {
        return toFailedAuthThrottleResponse(globalFailedAuthBucket, now);
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function resetApiKeyAuthRateLimitForTests() {
    failedAuthBuckets.clear();
    globalFailedAuthBucket = null;
    keyAuthSuccessBuckets.clear();
}

// Only consulted on a failing attempt, never before a lookup succeeds - a request bearing a
// genuinely valid key must never be blocked by unrelated failed attempts sharing the same
// source bucket (e.g. behind a proxy with TRUST_PROXY unset, every client's request.ip
// collapses to one bucket, so one bad actor could otherwise 429 every valid key at once).
function rejectFailedApiKeyAttempt(req: NextRequest): NextResponse {
    return getFailedApiKeyAuthThrottleResponse(req) || recordFailedApiKeyAuth(req);
}

export async function authorizeApiKey(req: NextRequest, requiredScope?: string): Promise<ApiKeyAuthResult> {
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
        return { ok: false, response: rejectFailedApiKeyAttempt(req) };
    }

    const lookupValues = getApiKeyLookupValues(apiKey);
    if (lookupValues.length === 0) {
        return { ok: false, response: rejectFailedApiKeyAttempt(req) };
    }

    const keyRecord = await prisma.apiKey.findFirst({
        where: { key: { in: lookupValues } }
    });

    if (!keyRecord || !keyRecord.isActive) {
        return { ok: false, response: rejectFailedApiKeyAttempt(req) };
    }

    if (requiredScope && !keyRecord.scopes.includes(requiredScope)) {
        return { ok: false, response: rejectFailedApiKeyAttempt(req) };
    }

    const successThrottle = checkKeyAuthSuccessThrottle(keyRecord.id);
    if (successThrottle) {
        return { ok: false, response: successThrottle };
    }

    // Async update last used (non-blocking). Also upgrades a legacy key's storage from
    // plaintext to a hashed digest the first time it authenticates post-lookup - the row still
    // matched on the plaintext branch of getApiKeyLookupValues, so it hasn't been upgraded yet.
    const updateData: { lastUsedAt: Date; key?: string } = { lastUsedAt: new Date() };
    if (isValidLegacyApiKeyFormat(apiKey) && keyRecord.key === apiKey) {
        updateData.key = createUpgradedLegacyApiKeyValue(apiKey);
    }
    prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: updateData
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
