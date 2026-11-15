import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        automation: {
            findMany: vi.fn(),
        },
        automationLog: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        campaign: {
            updateMany: vi.fn(),
        },
        lead: {
            updateMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { automationService } from "../AutomationService";

describe("automationService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("evaluate", () => {
        it("creates a pending_approval log for automations that require approval", async () => {
            (prisma.automation.findMany as any).mockResolvedValue([
                { id: "auto-1", teamId: "team-1", trigger: "lead.replied", action: "campaign.stop", requiresApproval: true, isActive: true },
            ]);
            (prisma.automationLog.create as any).mockResolvedValue({ id: "log-1" });

            const result = await automationService.evaluate("team-1", "lead.replied", { campaignId: "c1" });

            expect(prisma.automation.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1", trigger: "lead.replied", isActive: true },
            });
            expect(prisma.automationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ automationId: "auto-1", status: "pending_approval" }),
            });
            expect(prisma.campaign.updateMany).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                results: [{ automationId: "auto-1", status: "PENDING_APPROVAL", logId: "log-1" }],
            });
        });

        it("pauses the campaign and logs success for a campaign.stop automation", async () => {
            (prisma.automation.findMany as any).mockResolvedValue([
                { id: "auto-2", teamId: "team-1", trigger: "lead.replied", action: "campaign.stop", requiresApproval: false, isActive: true },
            ]);
            (prisma.automationLog.create as any).mockResolvedValue({ id: "log-2" });
            (prisma.campaign.updateMany as any).mockResolvedValue({ count: 1 });

            const result = await automationService.evaluate("team-1", "lead.replied", { campaignId: "c1" });

            expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: "c1", teamId: "team-1" },
                data: { status: "paused" },
            });
            expect(prisma.automationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ automationId: "auto-2", status: "success" }),
            });
            expect(result.results).toEqual([{ automationId: "auto-2", status: "SUCCESS", logId: "log-2" }]);
        });

        it("logs failed when executing the action throws", async () => {
            (prisma.automation.findMany as any).mockResolvedValue([
                { id: "auto-3", teamId: "team-1", trigger: "lead.replied", action: "campaign.stop", requiresApproval: false, isActive: true },
            ]);
            (prisma.campaign.updateMany as any).mockRejectedValue(new Error("campaign not found"));
            (prisma.automationLog.create as any).mockResolvedValue({ id: "log-3" });

            const result = await automationService.evaluate("team-1", "lead.replied", { campaignId: "c1" });

            expect(prisma.automationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ automationId: "auto-3", status: "failed" }),
            });
            expect(result.results).toEqual([{ automationId: "auto-3", status: "FAILED", logId: "log-3" }]);
        });

        it("fails instead of pausing a campaign that belongs to another team", async () => {
            (prisma.automation.findMany as any).mockResolvedValue([
                { id: "auto-4", teamId: "team-1", trigger: "lead.replied", action: "campaign.stop", requiresApproval: false, isActive: true },
            ]);
            (prisma.campaign.updateMany as any).mockResolvedValue({ count: 0 });
            (prisma.automationLog.create as any).mockResolvedValue({ id: "log-4" });

            const result = await automationService.evaluate("team-1", "lead.replied", { campaignId: "campaign-of-team-2" });

            expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: "campaign-of-team-2", teamId: "team-1" },
                data: { status: "paused" },
            });
            expect(result.results).toEqual([{ automationId: "auto-4", status: "FAILED", logId: "log-4" }]);
        });

        it("tags a lead only inside the automation's own team", async () => {
            (prisma.automation.findMany as any).mockResolvedValue([
                { id: "auto-5", teamId: "team-1", trigger: "lead.replied", action: "lead.tag", requiresApproval: false, isActive: true },
            ]);
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 0 });
            (prisma.automationLog.create as any).mockResolvedValue({ id: "log-5" });

            const result = await automationService.evaluate("team-1", "lead.replied", { leadId: "lead-of-team-2", tag: "hot" });

            expect(prisma.lead.updateMany).toHaveBeenCalledWith({
                where: { id: "lead-of-team-2", teamId: "team-1" },
                data: { tags: { push: "hot" } },
            });
            expect(result.results).toEqual([{ automationId: "auto-5", status: "FAILED", logId: "log-5" }]);
        });
    });

    describe("approveLog", () => {
        it("marks the log as success when it belongs to the requesting team", async () => {
            (prisma.automationLog.findUnique as any).mockResolvedValue({
                id: "log-1",
                automation: { teamId: "team-1" },
            });
            (prisma.automationLog.update as any).mockResolvedValue({ id: "log-1", status: "success" });

            const result = await automationService.approveLog("team-1", "log-1");

            expect(prisma.automationLog.update).toHaveBeenCalledWith({
                where: { id: "log-1" },
                data: expect.objectContaining({ status: "success" }),
            });
            expect(result).toEqual({ id: "log-1", status: "success" });
        });

        it("throws when the log belongs to a different team", async () => {
            (prisma.automationLog.findUnique as any).mockResolvedValue({
                id: "log-1",
                automation: { teamId: "other-team" },
            });

            await expect(automationService.approveLog("team-1", "log-1")).rejects.toThrow("Not found");
            expect(prisma.automationLog.update).not.toHaveBeenCalled();
        });

        it("throws when the log doesn't exist", async () => {
            (prisma.automationLog.findUnique as any).mockResolvedValue(null);

            await expect(automationService.approveLog("team-1", "missing")).rejects.toThrow("Not found");
        });
    });
});
