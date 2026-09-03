import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConversationState } from "@prisma/client";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
        meetingCoordinationQueue: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        conversationThread: { findFirst: vi.fn(), findUnique: vi.fn() },
    },
}));

vi.mock("@/modules/conversation/ConversationService", () => ({
    ConversationService: {
        startThread: vi.fn(),
        transitionState: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { ConversationService } from "@/modules/conversation/ConversationService";
import { CallerService } from "./CallerService";

describe("CallerService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getQueue", () => {
        it("scopes both the assigned and pool queries to the caller's team via the lead relation", async () => {
            (prisma.meetingCoordinationQueue.findMany as any).mockResolvedValue([]);

            await CallerService.getQueue("user-1", "team-a");

            expect(prisma.meetingCoordinationQueue.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ assignedUserId: "user-1", lead: { teamId: "team-a" } }),
                })
            );
            expect(prisma.meetingCoordinationQueue.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ assignedUserId: null, lead: { teamId: "team-a" } }),
                })
            );
        });
    });

    describe("claimLead", () => {
        it("refuses to claim a lead belonging to another team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            await expect(CallerService.claimLead("lead-from-team-b", "user-1", "team-a")).rejects.toThrow("LEAD_NOT_FOUND");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({
                where: { id: "lead-from-team-b", teamId: "team-a" },
                select: { id: true },
            });
            expect(prisma.lead.updateMany).not.toHaveBeenCalled();
        });

        it("claims a lead belonging to the caller's own team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ id: "queue-1" });
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (ConversationService.startThread as any).mockResolvedValue({ id: "thread-1" });
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });
            (prisma.meetingCoordinationQueue.update as any).mockResolvedValue({ id: "queue-1" });

            await CallerService.claimLead("lead-1", "user-1", "team-a");

            expect(prisma.lead.updateMany).toHaveBeenCalledWith({
                where: { id: "lead-1", teamId: "team-a" },
                data: expect.objectContaining({ pipelineState: "COORDINATING" }),
            });
        });
    });

    describe("completeTask", () => {
        it("refuses to complete a task for a lead belonging to another team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            await expect(
                CallerService.completeTask("lead-from-team-b", "user-1", "team-a", ConversationState.CLOSED)
            ).rejects.toThrow("LEAD_NOT_FOUND");

            expect(prisma.meetingCoordinationQueue.findUnique).not.toHaveBeenCalled();
        });

        it("scopes the Lead.pipelineState mutation to the caller's team on completion", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ assignedUserId: "user-1" });
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (prisma.meetingCoordinationQueue.update as any).mockResolvedValue({});
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

            await CallerService.completeTask("lead-1", "user-1", "team-a", ConversationState.CLOSED);

            expect(prisma.lead.updateMany).toHaveBeenCalledWith({
                where: { id: "lead-1", teamId: "team-a" },
                data: expect.objectContaining({ pipelineState: "COMPLETED" }),
            });
        });
    });
});
