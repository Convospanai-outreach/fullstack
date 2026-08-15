import { describe, expect, it } from "vitest";
import { isWebOwnedPath } from "../route";

describe("isWebOwnedPath", () => {
    describe("settings", () => {
        it("keeps branding and hidden-features web-owned", () => {
            expect(isWebOwnedPath(["settings", "branding"])).toBe(true);
            expect(isWebOwnedPath(["settings", "hidden-features"])).toBe(true);
        });

        it("proxies everything else under settings to apps/api", () => {
            expect(isWebOwnedPath(["settings"])).toBe(false);
            expect(isWebOwnedPath(["settings", "sso"])).toBe(false);
            expect(isWebOwnedPath(["settings", "guardrails"])).toBe(false);
            expect(isWebOwnedPath(["settings", "governance", "analytics"])).toBe(false);
            expect(isWebOwnedPath(["settings", "webhooks", "secret"])).toBe(false);
        });
    });

    describe("email", () => {
        it("keeps the public unsubscribe link web-owned", () => {
            expect(isWebOwnedPath(["email", "unsubscribe", "abc123"])).toBe(true);
        });

        it("proxies send/compose/track/verify to apps/api", () => {
            expect(isWebOwnedPath(["email", "send"])).toBe(false);
            expect(isWebOwnedPath(["email", "compose"])).toBe(false);
            expect(isWebOwnedPath(["email", "track", "open", "abc123"])).toBe(false);
        });
    });

    describe("leads", () => {
        it("keeps list/create, single-lead, and timeline web-owned", () => {
            expect(isWebOwnedPath(["leads"])).toBe(true);
            expect(isWebOwnedPath(["leads", "lead-1"])).toBe(true);
            expect(isWebOwnedPath(["leads", "lead-1", "timeline"])).toBe(true);
        });

        it("proxies bulk/export/import to apps/api instead of treating them as a lead id", () => {
            expect(isWebOwnedPath(["leads", "bulk"])).toBe(false);
            expect(isWebOwnedPath(["leads", "export"])).toBe(false);
            expect(isWebOwnedPath(["leads", "import"])).toBe(false);
        });

        it("proxies per-lead action routes apps/web doesn't implement", () => {
            expect(isWebOwnedPath(["leads", "lead-1", "action"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "enrich"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "identity"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "journey"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "journey", "suggestions"])).toBe(false);
        });
    });

    describe("workflows", () => {
        it("is never web-owned - the whole builder lives in apps/api", () => {
            expect(isWebOwnedPath(["workflows"])).toBe(false);
            expect(isWebOwnedPath(["workflows", "wf-1"])).toBe(false);
            expect(isWebOwnedPath(["workflows", "wf-1", "run"])).toBe(false);
        });
    });

    it("returns false for unrelated roots (handled by WEB_OWNED_API_ROOTS or the default proxy)", () => {
        expect(isWebOwnedPath(["campaigns", "c-1"])).toBe(false);
    });
});
