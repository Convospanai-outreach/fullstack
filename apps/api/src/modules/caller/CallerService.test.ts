import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConversationState } from "@prisma/client";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
        teamMember: { findMany: vi.fn() },
        meetingCoordinationQueue: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        conversationThread: { findFirst: vi.fn(), findUnique: vi.fn() },
        leadActivity: { create: vi.fn() },
    },
}));

vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: vi.fn() } }));

vi.mock("@/modules/conversation/ConversationService", () => ({
    ConversationService: {
        startThread: vi.fn(),
        transitionState: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { ConversationService } from "@/modules/conversation/ConversationService";
import { NotificationDispatcher } from "@/lib/notifications";
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

    describe("ensureQueueEntry", () => {
        beforeEach(() => {
            (prisma.conversationThread.findFirst as any).mockResolvedValue({ id: "t1", state: ConversationState.HANDOFF_REQUIRED });
        });

        it("queues a HOT lead above a WARM one", async () => {
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
            await CallerService.ensureQueueEntry("lead-hot", "HOT");
            await CallerService.ensureQueueEntry("lead-warm", "WARM");

            expect(prisma.meetingCoordinationQueue.create).toHaveBeenNthCalledWith(1, { data: { leadId: "lead-hot", status: "PENDING", priority: 1 } });
            expect(prisma.meetingCoordinationQueue.create).toHaveBeenNthCalledWith(2, { data: { leadId: "lead-warm", status: "PENDING", priority: 0 } });
        });

        it("raises a waiting WARM entry to HOT priority when the lead turns HOT", async () => {
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "PENDING", priority: 0 });
            await CallerService.ensureQueueEntry("lead-1", "HOT");

            expect(prisma.meetingCoordinationQueue.create).not.toHaveBeenCalled();
            expect(prisma.meetingCoordinationQueue.update).toHaveBeenCalledWith({ where: { leadId: "lead-1" }, data: { priority: 1 } });
        });

        it("leaves a claimed or finished entry alone", async () => {
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "IN_PROGRESS", priority: 0 });
            await CallerService.ensureQueueEntry("lead-1", "HOT");

            expect(prisma.meetingCoordinationQueue.update).not.toHaveBeenCalled();
        });

        it("does not lower the priority of a HOT entry when the lead is scored WARM", async () => {
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "PENDING", priority: 1 });
            await CallerService.ensureQueueEntry("lead-1", "WARM");

            expect(prisma.meetingCoordinationQueue.update).not.toHaveBeenCalled();
        });

        it("names the tier in the new conversation thread's first transition", async () => {
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (ConversationService.startThread as any).mockResolvedValue({ id: "t-new" });
            await CallerService.ensureQueueEntry("lead-1", "WARM");

            expect(ConversationService.transitionState).toHaveBeenCalledWith("t-new", ConversationState.ENGAGED, "Auto: Lead scored WARM");
        });

        describe("alerting callers", () => {
            beforeEach(() => {
                (prisma.lead.findUnique as any).mockResolvedValue({ teamId: "team-a", fullName: "Asha Rao", company: "Acme" });
                (prisma.teamMember.findMany as any).mockResolvedValue([{ userId: "caller-1" }, { userId: "caller-2" }]);
            });

            it("tells every active caller on the lead's team when a new HOT lead is queued", async () => {
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
                await CallerService.ensureQueueEntry("lead-1", "HOT");

                expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
                    where: { teamId: "team-a", status: "active", userId: { not: null }, user: { enterpriseRole: "CALLER" } },
                    select: { userId: true },
                });
                expect(NotificationDispatcher.send).toHaveBeenCalledTimes(2);
                expect(NotificationDispatcher.send).toHaveBeenCalledWith("caller-1", "LEAD", "Hot lead ready to call", "Asha Rao at Acme is waiting in the Calling queue.", { leadId: "lead-1", link: "/caller" });
            });

            it("tells callers when a waiting WARM lead is raised to HOT", async () => {
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "PENDING", priority: 0 });
                await CallerService.ensureQueueEntry("lead-1", "HOT");

                expect(NotificationDispatcher.send).toHaveBeenCalledTimes(2);
            });

            it("does not alert for a WARM lead, an already-HOT entry, or a claimed entry", async () => {
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
                await CallerService.ensureQueueEntry("lead-1", "WARM");
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "PENDING", priority: 1 });
                await CallerService.ensureQueueEntry("lead-1", "HOT");
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ leadId: "lead-1", status: "IN_PROGRESS", priority: 0 });
                await CallerService.ensureQueueEntry("lead-1", "HOT");

                expect(NotificationDispatcher.send).not.toHaveBeenCalled();
            });

            it("sends nothing when the team has no callers", async () => {
                (prisma.teamMember.findMany as any).mockResolvedValue([]);
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
                await CallerService.ensureQueueEntry("lead-1", "HOT");

                expect(NotificationDispatcher.send).not.toHaveBeenCalled();
            });

            it("still queues the lead when the alert fails", async () => {
                (prisma.teamMember.findMany as any).mockRejectedValue(new Error("db down"));
                (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue(null);
                await expect(CallerService.ensureQueueEntry("lead-1", "HOT")).resolves.toBeUndefined();

                expect(prisma.meetingCoordinationQueue.create).toHaveBeenCalled();
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
                data: expect.objectContaining({ status: "LOST", pipelineState: "CLOSED_LOST", lostAt: expect.any(Date) }),
            });
            expect((prisma.lead.updateMany as any).mock.calls[0][0].data).not.toHaveProperty("wonAt");
        });

        it("records the call as a timestamped CALL activity on the lead, by the caller", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ assignedUserId: "user-1" });
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (prisma.meetingCoordinationQueue.update as any).mockResolvedValue({});
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

            await CallerService.completeTask("lead-1", "user-1", "team-a", ConversationState.MEETING_CONFIRMED, "Booked Thursday");

            expect(prisma.leadActivity.create).toHaveBeenCalledWith({
                data: { leadId: "lead-1", channel: "CALL", type: "CALL_REPLIED", title: "Call completed: meeting confirmed", notes: "Booked Thursday", createdBy: "user-1" },
            });
        });

        it("counts a callback or voicemail as a call made, not a conversation", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ assignedUserId: "user-1" });
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (prisma.meetingCoordinationQueue.update as any).mockResolvedValue({});

            await CallerService.completeTask("lead-1", "user-1", "team-a", ConversationState.COORDINATING);

            expect((prisma.leadActivity.create as any).mock.calls.at(-1)[0].data.type).toBe("CALL_CONTACTED");
        });

        it("records nothing for a lead outside the caller's team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);
            await expect(CallerService.completeTask("lead-x", "user-1", "team-a", ConversationState.CLOSED)).rejects.toThrow("LEAD_NOT_FOUND");
            expect(prisma.leadActivity.create).not.toHaveBeenCalled();
        });

        it("refuses to let a caller complete a colleague's already-claimed task (OPEN-233)", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ assignedUserId: "other-user" });

            await expect(
                CallerService.completeTask("lead-1", "user-1", "team-a", ConversationState.CLOSED)
            ).rejects.toThrow("NOT_ASSIGNED_TO_CALLER");

            expect(prisma.meetingCoordinationQueue.update).not.toHaveBeenCalled();
            expect(prisma.lead.updateMany).not.toHaveBeenCalled();
        });

        it("allows completing an unclaimed (unassigned) task", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.meetingCoordinationQueue.findUnique as any).mockResolvedValue({ assignedUserId: null });
            (prisma.conversationThread.findFirst as any).mockResolvedValue(null);
            (prisma.meetingCoordinationQueue.update as any).mockResolvedValue({});
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

            await CallerService.completeTask("lead-1", "user-1", "team-a", ConversationState.CLOSED);

            expect(prisma.lead.updateMany).toHaveBeenCalledWith({
                where: { id: "lead-1", teamId: "team-a" },
                data: expect.objectContaining({ status: "LOST", pipelineState: "CLOSED_LOST", lostAt: expect.any(Date) }),
            });
            expect((prisma.lead.updateMany as any).mock.calls[0][0].data).not.toHaveProperty("wonAt");
        });
    });
});
