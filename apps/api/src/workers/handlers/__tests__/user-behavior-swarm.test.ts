import { describe, expect, it } from "vitest";
import { buildUserBehaviorReport } from "../user-behavior-swarm";

describe("user behavior swarm", () => {
    it("flags empty workspace blockers for first-time users", () => {
        const report = buildUserBehaviorReport("First-time Founder User", "Test onboarding", {
            campaigns: 0,
            activeCampaigns: 0,
            leads: 0,
            pendingApprovals: 0,
        });

        expect(report.persona).toBe("First-time founder");
        expect(report.frictionScore).toBeGreaterThanOrEqual(70);
        expect(report.findings.some((finding) => finding.scenario === "First campaign activation")).toBe(true);
        expect(report.findings.some((finding) => finding.scenario === "Lead journey start")).toBe(true);
    });

    it("maps operator roles to outreach journey checks", () => {
        const report = buildUserBehaviorReport("Sales Operator User", "Test lead journey", {
            campaigns: 2,
            activeCampaigns: 0,
            leads: 25,
            pendingApprovals: 1,
        });

        expect(report.persona).toBe("Sales operator");
        expect(report.journey).toContain("LinkedIn capture");
        expect(report.findings.some((finding) => finding.scenario === "Draft-to-active handoff")).toBe(true);
        expect(report.confidence).toBe("high");
    });
});
