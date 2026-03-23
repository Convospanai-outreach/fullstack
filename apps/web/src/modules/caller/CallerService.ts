import { prisma } from "@/lib/db";
import { ConversationState } from "@prisma/client";
import { ConversationService } from "@/modules/conversation/ConversationService";

export class CallerService {

    /**
     * Helper to ensure coordination queue entry exists for a lead.
     */
    static async ensureQueueEntry(leadId: string) {
        const existing = await prisma.meetingCoordinationQueue.findUnique({
            where: { leadId }
        });

        if (!existing) {
            await prisma.meetingCoordinationQueue.create({
                data: {
                    leadId,
                    status: "PENDING",
                    priority: 0
                }
            });
        }
    }

    /**
     * Gets leads that need human attention.
     * Criteria:
     * 1. Conversation State is HANDOFF_REQUIRED or COORDINATING
     * 2. If assigned, match assignedUserId
     * 3. If unassigned, show PENDING items
     */
    static async getQueue(userId: string) {
        // High priority: Assigned to me
        const assigned = await prisma.meetingCoordinationQueue.findMany({
            where: {
                assignedUserId: userId,
                status: { not: "COMPLETED" }
            },
            include: {
                lead: {
                    include: {
                        threads: {
                            where: { state: { in: ["HANDOFF_REQUIRED", "COORDINATING"] } },
                            orderBy: { updatedAt: "desc" },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { priority: "desc" }
        });

        // Unassigned pool (pull mode)
        // Only if user has capacity? For now simpler.
        const pool = await prisma.meetingCoordinationQueue.findMany({
            where: {
                assignedUserId: null,
                status: "PENDING"
            },
            include: {
                lead: {
                    include: {
                        threads: {
                            where: { state: "HANDOFF_REQUIRED" },
                            orderBy: { updatedAt: "desc" },
                            take: 1
                        }
                    }
                }
            },
            take: 10,
            orderBy: { priority: "desc" }
        });

        return { assigned, pool };
    }

    /**
     * Claims a lead from the pool.
     */
    static async claimLead(leadId: string, userId: string) {
        // Ensure queue entry exists just in case
        await this.ensureQueueEntry(leadId);

        // Transition Conversation to COORDINATING if not already
        const thread = await prisma.conversationThread.findFirst({
            where: { leadId },
            orderBy: { updatedAt: 'desc' }
        });

        if (thread && thread.state === ConversationState.HANDOFF_REQUIRED) {
            await ConversationService.transitionState(thread.id, ConversationState.COORDINATING, `Claimed by user ${userId}`);
        }

        // Assign Queue Item (ATOMIC CHECK)
        try {
            return await prisma.meetingCoordinationQueue.update({
                where: { 
                    leadId,
                    assignedUserId: null // ONLY claim if unassigned
                },
                data: {
                    assignedUserId: userId,
                    status: "IN_PROGRESS",
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            // Prisma will throw error if 'where' clause doesn't match
            throw new Error("LEAD_ALREADY_CLAIMED");
        }
    }

    /**
     * Completes the calling task.
     */
    static async completeTask(leadId: string, userId: string, outcome: ConversationState, notes?: string) {
        // Verify assignment
        const queueItem = await prisma.meetingCoordinationQueue.findUnique({ where: { leadId } });
        if (queueItem?.assignedUserId !== userId && queueItem?.assignedUserId !== null) {
            // Force override could be allowed for admins, but restricting for now
            // throw new Error("Not assigned to this caller");
        }

        const thread = await prisma.conversationThread.findFirst({
            where: { leadId },
            orderBy: { updatedAt: 'desc' }
        });

        if (thread) {
            await ConversationService.transitionState(thread.id, outcome, notes);
        }

        // Update queue status
        // If closed/meeting_confirmed, we mark queue done.
        if (outcome === ConversationState.CLOSED || outcome === ConversationState.MEETING_CONFIRMED) {
            await prisma.meetingCoordinationQueue.update({
                where: { leadId },
                data: { status: "COMPLETED" }
            });
        } else {
            // Keep in progress or release? 
            // If they just left VM, maybe keep it assigned?
            // For MVP: keep assigned.
        }
    }
}
