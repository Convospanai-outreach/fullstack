import { createHmac, randomUUID } from "crypto";

// Signed identity headers apps/web sends when it calls apps/api on a user's
// behalf. Verified by apps/api/src/lib/internalAuth.ts.
//
// The v2 signature (x-craftmyfunnel-auth-signature-v2 + x-craftmyfunnel-auth-nonce,
// roadmap 3.5 / S-13) binds method, path and a single-use nonce. The legacy v1
// signature is no longer sent: apps/api accepts only v2.
export function buildInternalAuthHeaders(input: {
    secret: string;
    userId: string;
    email: string;
    role: string;
    method: string;
    /** Pathname of the apps/api URL being called: no query string, as serialized by URL. */
    path: string;
    now?: number;
    nonce?: string;
}): Record<string, string> {
    const timestamp = String(input.now ?? Date.now());
    const nonce = input.nonce ?? randomUUID();
    // JSON array, not a dot-join: email and path are user-influenced and must not
    // be able to shift field boundaries.
    const payloadV2 = JSON.stringify([
        "v2",
        timestamp,
        nonce,
        input.method.toUpperCase(),
        input.path,
        input.userId,
        input.email,
        input.role,
    ]);

    return {
        "x-craftmyfunnel-user-id": input.userId,
        "x-craftmyfunnel-user-email": input.email,
        "x-craftmyfunnel-user-role": input.role,
        "x-craftmyfunnel-auth-ts": timestamp,
        "x-craftmyfunnel-auth-nonce": nonce,
        "x-craftmyfunnel-auth-signature-v2": createHmac("sha256", input.secret).update(payloadV2).digest("hex"),
    };
}
