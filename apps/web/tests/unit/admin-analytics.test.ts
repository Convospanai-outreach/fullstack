import { describe, expect, it, vi } from "vitest";
import { trackCustomEvent } from "../../src/components/analytics/GoogleAnalytics";
import { Telemetry, trackTelemetry } from "../../src/lib/analytics/telemetry";

describe("Google Analytics & User Telemetry", () => {
    it("trackCustomEvent handles undefined window or gtag gracefully without throwing", () => {
        expect(() => trackCustomEvent("test_event", { foo: "bar" })).not.toThrow();
    });

    it("trackCustomEvent calls window.gtag when available", () => {
        const gtagMock = vi.fn();
        (global as any).window = { gtag: gtagMock };

        trackCustomEvent("lead_approved", { leadId: "lead-123" });
        expect(gtagMock).toHaveBeenCalledWith("event", "lead_approved", { leadId: "lead-123" });

        delete (global as any).window;
    });

    it("trackTelemetry formats payload and dispatches to available providers", () => {
        const gtagMock = vi.fn();
        const posthogMock = { capture: vi.fn() };
        (global as any).window = { gtag: gtagMock, posthog: posthogMock };

        trackTelemetry({
            event: "user_signup",
            category: "auth",
            properties: { plan: "pro" },
            userId: "user-1",
            teamId: "team-1",
        });

        expect(gtagMock).toHaveBeenCalledWith(
            "event",
            "user_signup",
            expect.objectContaining({
                category: "auth",
                plan: "pro",
                team_id: "team-1",
            })
        );
        expect(posthogMock.capture).toHaveBeenCalledWith(
            "user_signup",
            expect.objectContaining({
                category: "auth",
                plan: "pro",
                team_id: "team-1",
            })
        );

        delete (global as any).window;
    });

    it("Telemetry convenience methods dispatch matching events", () => {
        const gtagMock = vi.fn();
        (global as any).window = { gtag: gtagMock };

        Telemetry.login("user-1", "google");
        expect(gtagMock).toHaveBeenCalledWith("event", "user_login", expect.objectContaining({ method: "google" }));

        Telemetry.planSelected("Growth", 99);
        expect(gtagMock).toHaveBeenCalledWith("event", "pricing_plan_selected", expect.objectContaining({ plan: "Growth", price: 99 }));

        Telemetry.leadApproved("lead-456", "team-999");
        expect(gtagMock).toHaveBeenCalledWith("event", "lead_approved", expect.objectContaining({ leadId: "lead-456", team_id: "team-999" }));

        Telemetry.adminViewAccessed("super_overview", "admin-1");
        expect(gtagMock).toHaveBeenCalledWith("event", "admin_view_accessed", expect.objectContaining({ view: "super_overview" }));

        delete (global as any).window;
    });
});
