import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LINK_TOKEN_MAX_LENGTH, LINK_TOKEN_TTL_MS, signLinkToken, verifyLinkToken } from "../linkToken";

const NOW = new Date("2030-01-07T10:00:00Z");
const REPLY = "3f1c2b8e-1d4a-4c55-9a1e-6c0f6b2d9e10";

describe("creator funnel link tokens", () => {
    const original = process.env["NEXTAUTH_SECRET"];
    beforeEach(() => {
        process.env["NEXTAUTH_SECRET"] = "s".repeat(32);
    });
    afterEach(() => {
        process.env["NEXTAUTH_SECRET"] = original;
    });

    it("round-trips the auto-reply id, URL-safe and short, until it expires", () => {
        const token = signLinkToken(REPLY, NOW);
        expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
        expect(token.length).toBeLessThanOrEqual(LINK_TOKEN_MAX_LENGTH);
        expect(verifyLinkToken(token, new Date(NOW.getTime() + LINK_TOKEN_TTL_MS - 1000))).toBe(REPLY);
        expect(verifyLinkToken(token, new Date(NOW.getTime() + LINK_TOKEN_TTL_MS + 1000))).toBeNull();
    });

    it("rejects forged, tampered and malformed tokens, and tokens signed with another secret", () => {
        const token = signLinkToken(REPLY, NOW);
        const [body, sig] = token.split(".");
        const forgedBody = Buffer.from(JSON.stringify({ r: "someone-else", e: 9999999999 })).toString("base64url");
        expect(verifyLinkToken(`${forgedBody}.${sig}`, NOW)).toBeNull();
        expect(verifyLinkToken(`${body}.${"A".repeat(22)}`, NOW)).toBeNull();
        expect(verifyLinkToken(body as string, NOW)).toBeNull();
        expect(verifyLinkToken(`${token}.x`, NOW)).toBeNull();
        expect(verifyLinkToken("", NOW)).toBeNull();

        process.env["NEXTAUTH_SECRET"] = "t".repeat(32);
        expect(verifyLinkToken(token, NOW)).toBeNull();
        delete process.env["NEXTAUTH_SECRET"];
        expect(verifyLinkToken(token, NOW)).toBeNull();
    });
});
