import { describe, expect, it } from "vitest";
import { computeFunnelSteps, type FunnelInput, type FunnelStep, type StepState } from "./instagramFunnelSteps";

const empty: FunnelInput = { accounts: [], domains: [], pages: [], triggers: [] };
const state = (input: FunnelInput) =>
    Object.fromEntries(computeFunnelSteps(input).map((s) => [s.key, s.state])) as Record<FunnelStep["key"], StepState>;

describe("computeFunnelSteps", () => {
    it("starts with only Instagram to do and the rest waiting", () => {
        expect(state(empty)).toEqual({ instagram: "todo", domain: "optional", page: "todo", trigger: "blocked", test: "blocked" });
    });

    it("asks to reconnect when every Instagram account needs it", () => {
        const steps = computeFunnelSteps({ ...empty, accounts: [{ platform: "INSTAGRAM", status: "NEEDS_RECONNECT" }] });
        expect(steps[0].state).toBe("todo");
        expect(steps[0].action).toBe("Reconnect");
    });

    it("ignores Facebook Pages when checking Instagram", () => {
        expect(state({ ...empty, accounts: [{ platform: "FACEBOOK_PAGE", status: "CONNECTED" }] }).instagram).toBe("todo");
    });

    it("keeps the reply blocked until Instagram is connected and a page is published", () => {
        const ig = { platform: "INSTAGRAM", status: "CONNECTED" };
        expect(state({ ...empty, accounts: [ig], pages: [{ status: "draft" }] }).trigger).toBe("blocked");
        expect(state({ ...empty, pages: [{ status: "published" }] }).trigger).toBe("blocked");
        expect(state({ ...empty, accounts: [ig], pages: [{ status: "published" }] }).trigger).toBe("todo");
    });

    it("treats a switched-off reply as not done", () => {
        const input: FunnelInput = {
            accounts: [{ platform: "INSTAGRAM", status: "CONNECTED" }],
            domains: [],
            pages: [{ status: "published" }],
            triggers: [{ active: false, landingPageId: "p", sentLast7Days: 0 }],
        };
        const steps = computeFunnelSteps(input);
        expect(steps.find((s) => s.key === "trigger")?.state).toBe("todo");
        expect(steps.find((s) => s.key === "trigger")?.detail).toMatch(/switched off/);
    });

    it("finishes once a live reply has sent something", () => {
        const input: FunnelInput = {
            accounts: [{ platform: "INSTAGRAM", status: "CONNECTED" }],
            domains: [{ status: "active", homeSlug: "spring" }],
            pages: [{ status: "published" }],
            triggers: [{ active: true, landingPageId: "p", sentLast7Days: 2 }],
        };
        expect(state(input)).toEqual({ instagram: "done", domain: "done", page: "done", trigger: "done", test: "done" });
    });

    it("only counts replies that link to a page", () => {
        const input: FunnelInput = {
            accounts: [{ platform: "INSTAGRAM", status: "CONNECTED" }],
            domains: [],
            pages: [{ status: "published" }],
            triggers: [{ active: true, landingPageId: null, sentLast7Days: 5 }],
        };
        expect(state(input).trigger).toBe("todo");
        expect(state(input).test).toBe("blocked");
    });

    it("tells a user with a domain but no root page where to pick one", () => {
        const page = computeFunnelSteps({
            ...empty,
            domains: [{ status: "active", homeSlug: null }],
            pages: [{ status: "published" }],
        }).find((s) => s.key === "page");
        expect(page?.detail).toMatch(/root/);
    });

    it("shows a pending domain as waiting, not done", () => {
        const domain = computeFunnelSteps({ ...empty, domains: [{ status: "pending", homeSlug: null }] }).find((s) => s.key === "domain");
        expect(domain?.state).toBe("optional");
        expect(domain?.detail).toMatch(/Waiting/);
    });
});
