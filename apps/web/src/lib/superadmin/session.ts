import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SUPERADMIN_COOKIE_NAME = "cmf_superadmin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h - short-lived, ops surface, not "stay signed in forever"

function getSecret(): string {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
    // Server-side revoke switch for these otherwise-stateless cookies: changing
    // SUPERADMIN_SESSION_VERSION invalidates every outstanding superadmin session
    // without rotating NEXTAUTH_SECRET (which would sign out every web user too).
    // Unset/empty keeps the original key, so shipping this signs nobody out.
    const version = process.env["SUPERADMIN_SESSION_VERSION"];
    return version ? `${secret}:${version}` : secret;
}

// Opaque token, HMAC-signed with the same secret/scheme as the existing
// x-craftmyfunnel-* internal auth headers (apps/web/src/app/api/proxy/[...path]/route.ts)
// - not a JWT, since this repo has no jose/jsonwebtoken dependency to reach for.
export function signSuperAdminToken(userId: string): string {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + SESSION_TTL_MS;
    const payload = `sa_v1.${userId}.${issuedAt}.${expiresAt}`;
    const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
    return `${payload}.${signature}`;
}

export function verifySuperAdminToken(token: string | undefined | null): string | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 5 || parts[0] !== "sa_v1") return null;
    const [, userId, issuedAtStr, expiresAtStr, signature] = parts;
    if (!userId || !expiresAtStr || !signature) return null;

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

    const payload = `sa_v1.${userId}.${issuedAtStr}.${expiresAtStr}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

    try {
        const expectedBuffer = Buffer.from(expected, "hex");
        const actualBuffer = Buffer.from(signature, "hex");
        if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
            return null;
        }
    } catch {
        return null;
    }

    return userId;
}

export async function getSuperAdminUserId(): Promise<string | null> {
    const store = await cookies();
    return verifySuperAdminToken(store.get(SUPERADMIN_COOKIE_NAME)?.value);
}

export const SUPERADMIN_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
