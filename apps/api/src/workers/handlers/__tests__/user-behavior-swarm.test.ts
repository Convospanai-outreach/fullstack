import { describe, expect, it, vi } from "vitest";
import { buildDeterministicUserBehaviorReport, generateUserBehaviorReport } from "../user-behavior-swarm";

describe("user behavior swarm", () => {
    it("flags empty workspace blockers for first-time users", () => {
        const report = buildDeterministicUserBehaviorReport("First-time Founder User", "Test onboarding", {
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
        const report = buildDeterministicUserBehaviorReport("Sales Operator User", "Test lead journey", {
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
        const report = buildDeterministicUserBehaviorReport("RevOps Manager User", "Test multichannel status", {
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
        const report = buildDeterministicUserBehaviorReport("Workspace Admin User", "Test launch setup", {
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

describe("generateUserBehaviorReport (LLM-backed)", () => {
    const metrics = { campaigns: 2, activeCampaigns: 1, leads: 10, pendingApprovals: 1 };

    it("returns the validated LLM report when the model responds with well-formed JSON", async () => {
        const askAI = vi.fn().mockResolvedValue(JSON.stringify({
            persona: "First-time founder",
            scenario: "Simulated a founder's first session.",
            journey: ["Signup", "Dashboard"],
            frictionScore: 42,
            confidence: "high",
            findings: [
                {
                    scenario: "Confusing empty state",
                    priority: "P1",
                    severity: "medium",
                    affectedSurface: "/dashboard",
                    ownerArea: "web",
                    friction: "The dashboard doesn't explain what to do next.",
                    recommendation: "Add a setup checklist.",
                    testNeeded: "Snapshot test for empty dashboard state.",
                },
            ],
            nextBestTests: ["Run a smoke test for signup -> dashboard"],
        }));

        const report = await generateUserBehaviorReport(
            "First-time Founder User",
            "Test onboarding",
            metrics,
            "USER_BEHAVIOR",
            "team-1",
            askAI
        );

        expect(askAI).toHaveBeenCalledWith(
            expect.stringContaining("First-time founder"),
            "team-1",
            expect.objectContaining({ expectsJson: true })
        );
        expect(report.frictionScore).toBe(42);
        expect(report.findings).toHaveLength(1);
        expect(report.findings[0]?.scenario).toBe("Confusing empty state");
    });

    it("falls back to the deterministic report when the LLM call throws", async () => {
        const askAI = vi.fn().mockRejectedValue(new Error("provider unavailable"));

        const report = await generateUserBehaviorReport(
            "First-time Founder User",
            "Test onboarding",
            { campaigns: 0, activeCampaigns: 0, leads: 0, pendingApprovals: 0 },
            "USER_BEHAVIOR",
            "team-1",
            askAI
        );

        expect(report.findings.some((finding) => finding.scenario === "First campaign activation")).toBe(true);
    });

    it("falls back to the deterministic report when the LLM returns malformed JSON", async () => {
        const askAI = vi.fn().mockResolvedValue("not json at all");

        const report = await generateUserBehaviorReport(
            "First-time Founder User",
            "Test onboarding",
            { campaigns: 0, activeCampaigns: 0, leads: 0, pendingApprovals: 0 },
            "USER_BEHAVIOR",
            "team-1",
            askAI
        );

        expect(report.findings.some((finding) => finding.scenario === "First campaign activation")).toBe(true);
    });

    it("falls back to the deterministic report when the LLM omits every required field", async () => {
        const askAI = vi.fn().mockResolvedValue(JSON.stringify({ findings: [] }));

        const report = await generateUserBehaviorReport(
            "First-time Founder User",
            "Test onboarding",
            { campaigns: 0, activeCampaigns: 0, leads: 0, pendingApprovals: 0 },
            "USER_BEHAVIOR",
            "team-1",
            askAI
        );

        expect(report.findings.some((finding) => finding.scenario === "First campaign activation")).toBe(true);
    });
});
