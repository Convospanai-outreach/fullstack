import { createHmac, randomUUID } from "crypto";

// Signed identity headers apps/web sends when it calls apps/api on a user's
// behalf. Verified by apps/api/src/lib/internalAuth.ts.
//
// Two signatures ride together (roadmap 3.5 / S-13):
//   - v1 (x-craftmyfunnel-auth-signature): the original `v1.ts.userId.email.role`
//     HMAC, unchanged, so an apps/api build from before this change (web and api
//     deploy separately) still authenticates these requests.
//   - v2 (x-craftmyfunnel-auth-signature-v2 + x-craftmyfunnel-auth-nonce): also
//     binds method, path and a single-use nonce. Current apps/api builds verify
//     this one whenever it is present.
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
    const legacyPayload = `v1.${timestamp}.${input.userId}.${input.email}.${input.role}`;
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
        "x-craftmyfunnel-auth-signature": createHmac("sha256", input.secret).update(legacyPayload).digest("hex"),
        "x-craftmyfunnel-auth-nonce": nonce,
        "x-craftmyfunnel-auth-signature-v2": createHmac("sha256", input.secret).update(payloadV2).digest("hex"),
    };
}
