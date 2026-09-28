import { createHmac, randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    authenticateInternalRequest,
    internalAuthPath,
    verifyInternalAuthHeaders,
} from "../internalAuth";
import { createReplayCache } from "../replayCache";

// Roadmap 3.5 / S-13. The formats are re-derived here on purpose (not imported
// from the web signer) so this file pins the wire contract on the api side;
// apps/web/tests/unit/internal-auth-signing.test.ts checks the real signer.
const SECRET = "test-nextauth-secret";
const NOW = 1_800_000_000_000;
const REQ = { method: "GET", path: "/leads/export" };

function hmac(payload: string) {
    return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function legacyHeaders(over: Record<string, string> = {}) {
    const ts = String(NOW);
    return {
        "x-craftmyfunnel-user-id": "user-1",
        "x-craftmyfunnel-user-email": "u@example.com",
        "x-craftmyfunnel-user-role": "USER",
        "x-craftmyfunnel-auth-ts": ts,
        "x-craftmyfunnel-auth-signature": hmac(`v1.${ts}.user-1.u@example.com.USER`),
        ...over,
    };
}

function v2Headers(opts: { method?: string; path?: string; nonce?: string } = {}) {
    const ts = String(NOW);
    const nonce = opts.nonce ?? randomUUID();
    const payload = JSON.stringify([
        "v2", ts, nonce, opts.method ?? REQ.method, opts.path ?? REQ.path, "user-1", "u@example.com", "USER",
    ]);
    return legacyHeaders({
        "x-craftmyfunnel-auth-nonce": nonce,
        "x-craftmyfunnel-auth-signature-v2": hmac(payload),
    });
}

describe("verifyInternalAuthHeaders", () => {
    const originalSecret = process.env["NEXTAUTH_SECRET"];
    beforeEach(() => {
        process.env["NEXTAUTH_SECRET"] = SECRET;
    });
    afterEach(() => {
        process.env["NEXTAUTH_SECRET"] = originalSecret;
    });

    it("still accepts the legacy v1 format (web builds from before this change)", () => {
        expect(verifyInternalAuthHeaders(legacyHeaders(), REQ, NOW)).toMatchObject({
            sub: "user-1",
            email: "u@example.com",
            enterpriseRole: "USER",
        });
    });

    it("accepts the legacy format from a Headers instance too (auth.ts/admin.ts call sites)", () => {
        expect(verifyInternalAuthHeaders(new Headers(legacyHeaders()), REQ, NOW)?.sub).toBe("user-1");
    });

    it("accepts v2 bound to the same method and path", () => {
        const headers = v2Headers();
        expect(verifyInternalAuthHeaders(headers, REQ, NOW)).toMatchObject({
            sub: "user-1",
            nonce: headers["x-craftmyfunnel-auth-nonce"],
        });
    });

    it("accepts v2 on its own, without the v1 signature", () => {
        const headers: Record<string, string> = v2Headers();
        delete headers["x-craftmyfunnel-auth-signature"];
        expect(verifyInternalAuthHeaders(headers, REQ, NOW)?.sub).toBe("user-1");
    });

    it("rejects v2 replayed against a different path, even though the v1 signature is valid (no downgrade)", () => {
        expect(verifyInternalAuthHeaders(v2Headers(), { method: "GET", path: "/admin/users" }, NOW)).toBeNull();
    });

    it("rejects v2 replayed with a different method (no downgrade)", () => {
        expect(verifyInternalAuthHeaders(v2Headers(), { method: "DELETE", path: REQ.path }, NOW)).toBeNull();
    });

    it("rejects a swapped nonce (no downgrade)", () => {
        const headers = { ...v2Headers(), "x-craftmyfunnel-auth-nonce": randomUUID() };
        expect(verifyInternalAuthHeaders(headers, REQ, NOW)).toBeNull();
    });

    it("rejects a lone v2 header rather than falling back to v1", () => {
        const withNonceOnly = legacyHeaders({ "x-craftmyfunnel-auth-nonce": randomUUID() });
        const withSigOnly = legacyHeaders({ "x-craftmyfunnel-auth-signature-v2": "00".repeat(32) });
        expect(verifyInternalAuthHeaders(withNonceOnly, REQ, NOW)).toBeNull();
        expect(verifyInternalAuthHeaders(withSigOnly, REQ, NOW)).toBeNull();
    });

    it("rejects either format outside the 5-minute window", () => {
        const later = NOW + 5 * 60 * 1000 + 1;
        expect(verifyInternalAuthHeaders(legacyHeaders(), REQ, later)).toBeNull();
        expect(verifyInternalAuthHeaders(v2Headers(), REQ, later)).toBeNull();
    });

    it("rejects a forged v1 signature", () => {
        const headers = legacyHeaders({ "x-craftmyfunnel-user-id": "someone-else" });
        expect(verifyInternalAuthHeaders(headers, REQ, NOW)).toBeNull();
    });
});

describe("authenticateInternalRequest (single-use nonce)", () => {
    const originalSecret = process.env["NEXTAUTH_SECRET"];
    beforeEach(() => {
        process.env["NEXTAUTH_SECRET"] = SECRET;
    });
    afterEach(() => {
        process.env["NEXTAUTH_SECRET"] = originalSecret;
    });

    it("accepts a v2 header set once and rejects the replay", async () => {
        const headers = v2Headers();
        expect((await authenticateInternalRequest(headers, REQ, NOW))?.sub).toBe("user-1");
        expect(await authenticateInternalRequest(headers, REQ, NOW + 1000)).toBeNull();
    });

    it("leaves the verify-only function repeatable (auth.ts/admin.ts re-check after the adapter claimed)", async () => {
        const headers = v2Headers();
        expect(await authenticateInternalRequest(headers, REQ, NOW)).not.toBeNull();
        expect(verifyInternalAuthHeaders(headers, REQ, NOW)).not.toBeNull();
    });

    it("only claims a nonce after its signature verifies, so unsigned traffic cannot burn it", async () => {
        const nonce = randomUUID();
        const forged = { ...v2Headers({ nonce }), "x-craftmyfunnel-auth-signature-v2": "00".repeat(32) };
        expect(await authenticateInternalRequest(forged, REQ, NOW)).toBeNull();
        expect((await authenticateInternalRequest(v2Headers({ nonce }), REQ, NOW))?.sub).toBe("user-1");
    });

    it("does not track legacy requests (no nonce to claim)", async () => {
        const headers = legacyHeaders();
        expect(await authenticateInternalRequest(headers, REQ, NOW)).not.toBeNull();
        expect(await authenticateInternalRequest(headers, REQ, NOW)).not.toBeNull();
    });

    it("claims the nonce in the cache it is given (server.ts passes the Redis-backed one)", async () => {
        const headers = v2Headers();
        const nonces = { claim: vi.fn().mockResolvedValue(false) };

        expect(await authenticateInternalRequest(headers, REQ, NOW, nonces)).toBeNull();
        expect(nonces.claim).toHaveBeenCalledWith(headers["x-craftmyfunnel-auth-nonce"], NOW + 5 * 60 * 1000, NOW);
    });
});

describe("internalAuthPath", () => {
    it("binds the pathname only: no query string, no percent-decoding", () => {
        expect(internalAuthPath("/admin/super/users/a%7Cb?range=7d")).toBe("/admin/super/users/a%7Cb");
        expect(internalAuthPath("https://api.example.test/leads?x=1")).toBe("/leads");
    });
});

describe("createReplayCache", () => {
    it("rejects a key until it expires, then accepts it again", () => {
        const cache = createReplayCache();
        expect(cache.claim("k", 2000, 1000)).toBe(true);
        expect(cache.claim("k", 2000, 1999)).toBe(false);
        expect(cache.claim("k", 4000, 2000)).toBe(true);
    });

    it("stays bounded by evicting the oldest entry", () => {
        const cache = createReplayCache(2);
        expect(cache.claim("a", 10_000, 0)).toBe(true);
        expect(cache.claim("b", 10_000, 0)).toBe(true);
        expect(cache.claim("c", 10_000, 0)).toBe(true); // evicts "a"
        expect(cache.claim("b", 10_000, 0)).toBe(false);
        expect(cache.claim("a", 10_000, 0)).toBe(true);
    });

    it("at the cap, drops an expired entry sitting behind a live one before evicting anything live", () => {
        const cache = createReplayCache(2);
        expect(cache.claim("live", 100_000, 0)).toBe(true);
        expect(cache.claim("expired", 1_000, 0)).toBe(true); // inserted later, expires first
        expect(cache.claim("new", 100_000, 2_000)).toBe(true);
        expect(cache.claim("live", 100_000, 2_000)).toBe(false); // still remembered
    });
});
