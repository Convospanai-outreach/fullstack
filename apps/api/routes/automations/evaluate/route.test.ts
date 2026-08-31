import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        automation: { findMany: vi.fn() },
        automationLog: { create: vi.fn() },
        campaign: { updateMany: vi.fn() },
        lead: { updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

describe("/automations/evaluate - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.automationLog.create.mockResolvedValue({ id: "log-1" });
    });

    it("fails (does not pause) a campaign.stop automation targeting another team's campaignId", async () => {
        mockPrisma.automation.findMany.mockResolvedValue([
            { id: "auto-1", action: "campaign.stop", requiresApproval: false },
        ]);
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 0 });

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/automations/evaluate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trigger: "lead.stalled", context: { campaignId: "campaign-owned-by-team-b" } }),
        }));
        const payload = await response.json();

        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { id: "campaign-owned-by-team-b", teamId: "team-a" },
            data: { status: "paused" },
        });
        expect(payload.results[0].status).toBe("FAILED");
    });

    it("fails (does not tag) a lead.tag automation targeting another team's leadId", async () => {
        mockPrisma.automation.findMany.mockResolvedValue([
            { id: "auto-2", action: "lead.tag", requiresApproval: false },
        ]);
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/automations/evaluate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trigger: "lead.stalled", context: { leadId: "lead-owned-by-team-b", tag: "hot" } }),
        }));
        const payload = await response.json();

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-owned-by-team-b", teamId: "team-a" },
            data: { tags: { push: "hot" } },
        });
        expect(payload.results[0].status).toBe("FAILED");
    });

    it("succeeds when the campaign belongs to the caller's own team", async () => {
        mockPrisma.automation.findMany.mockResolvedValue([
            { id: "auto-1", action: "campaign.stop", requiresApproval: false },
        ]);
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/automations/evaluate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trigger: "lead.stalled", context: { campaignId: "campaign-owned-by-team-a" } }),
        }));
        const payload = await response.json();

        expect(payload.results[0].status).toBe("SUCCESS");
    });
});
