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
        expect(report.swarmType).toBe("USER_BEHAVIOR");
        expect(report.frictionScore).toBeGreaterThanOrEqual(70);
        expect(report.findings.some((finding) => finding.scenario === "First campaign activation")).toBe(true);
        expect(report.findings.some((finding) => finding.scenario === "Lead journey start")).toBe(true);
        expect(report.findings.every((finding) => finding.priority && finding.affectedSurface && finding.testNeeded)).toBe(true);
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

    it("adds lead journey continuity checks in lead journey mode", () => {
        const report = buildUserBehaviorReport("RevOps Manager User", "Test multichannel status", {
            campaigns: 1,
            activeCampaigns: 1,
            leads: 3,
            pendingApprovals: 0,
        }, "LEAD_JOURNEY");

        expect(report.swarmType).toBe("LEAD_JOURNEY");
        expect(report.persona).toBe("RevOps manager");
        expect(report.journey).toContain("Manual outreach done");
        expect(report.findings.some((finding) => finding.scenario === "Multi-channel status continuity")).toBe(true);
        expect(report.findings.some((finding) => finding.ownerArea === "api")).toBe(true);
    });

    it("adds admin readiness checks in launch readiness mode", () => {
        const report = buildUserBehaviorReport("Workspace Admin User", "Test launch setup", {
            campaigns: 1,
            activeCampaigns: 0,
            leads: 1,
            pendingApprovals: 2,
        }, "LAUNCH_READINESS");

        expect(report.swarmType).toBe("LAUNCH_READINESS");
        expect(report.persona).toBe("Workspace admin");
        expect(report.findings.some((finding) => finding.scenario === "Auth and configuration confidence")).toBe(true);
        expect(report.findings.some((finding) => finding.ownerArea === "deploy")).toBe(true);
    });
});
