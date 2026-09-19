import { describe, expect, it } from "vitest";
import { resolveRateLimitTier } from "@/lib/rateLimitTiers";

describe("resolveRateLimitTier", () => {
    it("classifies /auth/* as AUTH, IP-keyed", () => {
        expect(resolveRateLimitTier("/auth/verify-email", true)).toEqual({
            tier: "AUTH",
            endpoint: "auth",
            keyByIp: true,
        });
    });

    it("classifies /webhooks/* as WEBHOOK, IP-keyed", () => {
        expect(resolveRateLimitTier("/webhooks/razorpay", true)).toEqual({
            tier: "WEBHOOK",
            endpoint: "webhook",
            keyByIp: true,
        });
    });

    it("classifies the /api/webhooks/netjana-intel alias as WEBHOOK too", () => {
        expect(resolveRateLimitTier("/api/webhooks/netjana-intel", true).tier).toBe("WEBHOOK");
    });

    it("classifies /errors/client as ERROR_LOGGING, IP-keyed", () => {
        expect(resolveRateLimitTier("/errors/client", true)).toEqual({
            tier: "ERROR_LOGGING",
            endpoint: "error-logging",
            keyByIp: true,
        });
    });

    it("classifies /admin/* as ADMIN, user-keyed (not IP)", () => {
        expect(resolveRateLimitTier("/admin/audit", false)).toEqual({
            tier: "ADMIN",
            endpoint: "admin",
            keyByIp: false,
        });
    });

    it("classifies any other non-public route as AUTHENTICATED, user-keyed", () => {
        expect(resolveRateLimitTier("/leads/org-chart", false)).toEqual({
            tier: "AUTHENTICATED",
            endpoint: "authenticated",
            keyByIp: false,
        });
    });

    it("classifies any other public route as PUBLIC, IP-keyed (catch-all)", () => {
        expect(resolveRateLimitTier("/checkout/session", true)).toEqual({
            tier: "PUBLIC",
            endpoint: "public",
            keyByIp: true,
        });
    });

    it("never matches on an '/api'-prefixed convention this app doesn't use", () => {
        // Regression guard for the bug this item fixed: registeredPath here
        // never has an /api prefix (confirmed via server.ts's loadRoutes),
        // so a tier resolver written against that convention would silently
        // classify everything as PUBLIC/AUTHENTICATED instead of the
        // intended stricter tier. This locks in the real, prefix-free paths.
        expect(resolveRateLimitTier("/auth/verify-email", true).tier).not.toBe("PUBLIC");
        expect(resolveRateLimitTier("/webhooks/whatsapp", true).tier).not.toBe("PUBLIC");
        expect(resolveRateLimitTier("/admin/audit", false).tier).not.toBe("AUTHENTICATED");
    });
});
