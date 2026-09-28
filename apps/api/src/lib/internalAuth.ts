// Verifier for the HMAC-signed identity headers apps/web attaches when it calls
// apps/api on a user's behalf (the /api/proxy route and the superadmin client).
// Shared by the server.ts gate, auth.ts and admin.ts, which used to carry three
// identical copies.
//
// Two formats are accepted (roadmap 3.5 / S-13):
//   - v1 (legacy): HMAC over `v1.ts.userId.email.role`. No method, path or nonce,
//     so a captured header set replays against any route for 5 minutes. Still
//     accepted only because web builds from before this change send nothing else
//     and web/api deploy independently. Remove once no such web build can be live.
//   - v2: HMAC also binds method, path and a single-use nonce. Sent alongside v1
//     (x-craftmyfunnel-auth-nonce + x-craftmyfunnel-auth-signature-v2). When
//     either v2 header is present, v2 must verify; there is no fallback to v1.
//
// Imports stay relative/builtin-only: apps/web/tests/unit imports this file to
// check the web signer against it.

import { createHmac, timingSafeEqual } from "crypto";
import { createReplayCache } from "./replayCache";

export const INTERNAL_AUTH_MAX_SKEW_MS = 5 * 60 * 1000;

export const INTERNAL_AUTH_HEADER_NAMES = new Set([
    "x-craftmyfunnel-user-id",
    "x-craftmyfunnel-user-email",
    "x-craftmyfunnel-user-role",
    "x-craftmyfunnel-auth-ts",
    "x-craftmyfunnel-auth-signature",
    "x-craftmyfunnel-auth-nonce",
    "x-craftmyfunnel-auth-signature-v2",
]);

type HeaderSource = Headers | Record<string, unknown>;

export interface InternalAuthRequest {
    method: string;
    /** URL pathname as received: no query string, not percent-decoded. */
    path: string;
}

export interface InternalIdentity {
    sub: string;
    email: string;
    enterpriseRole: string;
    issuedAt: number;
    /** Present only for the v2 format. */
    nonce?: string;
}

/** The path the v2 signature binds, derived the same way at every call site. */
export function internalAuthPath(url: string): string {
    return new URL(url, "http://localhost").pathname;
}

function readHeader(headers: HeaderSource, name: string): string {
    if (typeof headers.get === "function") {
        return (headers as Headers).get(name) || "";
    }
    const value = (headers as Record<string, unknown>)[name];
    return typeof value === "string" ? value : "";
}

function signatureMatches(secret: string, payload: string, providedHex: string): boolean {
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(providedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Checks signature, binding and timestamp window. Has no side effects, so it is
 * safe to call more than once per request; the nonce is claimed separately by
 * authenticateInternalRequest.
 */
export function verifyInternalAuthHeaders(
    headers: HeaderSource,
    request: InternalAuthRequest,
    now: number = Date.now(),
): InternalIdentity | null {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) return null;

    const userId = readHeader(headers, "x-craftmyfunnel-user-id");
    const email = readHeader(headers, "x-craftmyfunnel-user-email");
    const role = readHeader(headers, "x-craftmyfunnel-user-role");
    const timestamp = readHeader(headers, "x-craftmyfunnel-auth-ts");
    const signature = readHeader(headers, "x-craftmyfunnel-auth-signature");
    const nonce = readHeader(headers, "x-craftmyfunnel-auth-nonce");
    const signatureV2 = readHeader(headers, "x-craftmyfunnel-auth-signature-v2");

    if (!userId || !timestamp) return null;

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > INTERNAL_AUTH_MAX_SKEW_MS) {
        return null;
    }

    if (nonce || signatureV2) {
        if (!nonce || !signatureV2) return null;
        // JSON array, not a dot-join: email and path are user-influenced and
        // must not be able to shift field boundaries.
        const payload = JSON.stringify([
            "v2",
            timestamp,
            nonce,
            request.method.toUpperCase(),
            request.path,
            userId,
            email,
            role,
        ]);
        if (!signatureMatches(secret, payload, signatureV2)) return null;
        return { sub: userId, email, enterpriseRole: role, issuedAt, nonce };
    }

    if (!signature) return null;
    const legacyPayload = `v1.${timestamp}.${userId}.${email}.${role}`;
    if (!signatureMatches(secret, legacyPayload, signature)) return null;
    return { sub: userId, email, enterpriseRole: role, issuedAt };
}

export interface NonceCache {
    claim(key: string, expiresAt: number, now?: number): boolean | Promise<boolean>;
}

// Per-process default (see replayCache.ts). server.ts passes the Redis-backed
// cache from sharedReplayCache.ts instead, which this file can't import. A nonce
// only needs remembering for as long as its timestamp would still pass the
// window check.
const usedNonces = createReplayCache();

/**
 * verifyInternalAuthHeaders plus single-use enforcement of the v2 nonce. Call it
 * exactly once per request (server.ts nextAdapter): a second call on the same
 * request would see its own nonce as a replay. The nonce is claimed only after
 * the signature verifies, so unsigned traffic cannot fill the cache.
 */
export async function authenticateInternalRequest(
    headers: HeaderSource,
    request: InternalAuthRequest,
    now: number = Date.now(),
    nonces: NonceCache = usedNonces,
): Promise<InternalIdentity | null> {
    const identity = verifyInternalAuthHeaders(headers, request, now);
    if (!identity) return null;
    if (
        identity.nonce !== undefined &&
        !(await nonces.claim(identity.nonce, identity.issuedAt + INTERNAL_AUTH_MAX_SKEW_MS, now))
    ) {
        return null;
    }
    return identity;
}
