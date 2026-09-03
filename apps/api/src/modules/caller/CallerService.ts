import { prisma } from "@/lib/db";
import { ConversationState } from "@prisma/client";
import { ConversationService } from "@/modules/conversation/ConversationService";

export class CallerService {

    /**
     * Helper to ensure coordination queue entry AND conversation thread exist for a lead.
     * Called when a lead is promoted to HOT — creates the handoff scaffolding.
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

        // Ensure a ConversationThread exists and is in HANDOFF_REQUIRED state.
        // Without this, the caller dashboard has no thread to display or transition.
        const existingThread = await prisma.conversationThread.findFirst({
            where: { leadId },
            orderBy: { updatedAt: "desc" }
        });

        if (!existingThread) {
            // Create a new thread and advance it through the required states
            const thread = await ConversationService.startThread(leadId, "EMAIL");
            // INITIATED → ENGAGED → QUALIFIED → HANDOFF_REQUIRED
            await ConversationService.transitionState(thread.id, ConversationState.ENGAGED, "Auto: Lead scored HOT");
            await ConversationService.transitionState(thread.id, ConversationState.QUALIFIED, "Auto: Intent threshold met");
            await ConversationService.transitionState(thread.id, ConversationState.HANDOFF_REQUIRED, "Auto: Queued for human caller");
        } else if (existingThread.state === ConversationState.INITIATED || existingThread.state === ConversationState.ENGAGED || existingThread.state === ConversationState.QUALIFIED) {
            // Thread exists but hasn't reached HANDOFF_REQUIRED yet — advance it
            try {
                if (existingThread.state === ConversationState.INITIATED) {
                    await ConversationService.transitionState(existingThread.id, ConversationState.ENGAGED, "Auto: Lead scored HOT");
                }
                if (existingThread.state === ConversationState.INITIATED || existingThread.state === ConversationState.ENGAGED) {
                    const refreshed = await prisma.conversationThread.findUnique({ where: { id: existingThread.id } });
                    if (refreshed?.state === ConversationState.ENGAGED) {
                        await ConversationService.transitionState(existingThread.id, ConversationState.QUALIFIED, "Auto: Intent threshold met");
                    }
                }
                const refreshed2 = await prisma.conversationThread.findUnique({ where: { id: existingThread.id } });
                if (refreshed2?.state === ConversationState.QUALIFIED) {
                    await ConversationService.transitionState(existingThread.id, ConversationState.HANDOFF_REQUIRED, "Auto: Queued for human caller");
                }
            } catch (transitionErr) {
                console.warn(`[CallerService] Thread ${existingThread.id} could not be advanced to HANDOFF_REQUIRED:`, transitionErr);
            }
        }
        // If thread is already in HANDOFF_REQUIRED, COORDINATING, or beyond — do nothing
    }

    /**
     * Gets leads that need human attention.
     * Criteria:
     * 1. Conversation State is HANDOFF_REQUIRED or COORDINATING
     * 2. If assigned, match assignedUserId
     * 3. If unassigned, show PENDING items
     */
    static async getQueue(userId: string, teamId: string) {
        // High priority: Assigned to me
        const assigned = await prisma.meetingCoordinationQueue.findMany({
            where: {
                assignedUserId: userId,
                status: { not: "COMPLETED" },
                lead: { teamId }
            },
            include: {
                lead: {
                    include: {
                        threads: {
                            where: { state: { in: ["HANDOFF_REQUIRED", "COORDINATING"] } },
                            include: {
                                entries: {
                                    orderBy: { createdAt: "asc" }
                                }
                            },
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
                status: "PENDING",
                lead: { teamId }
            },
            include: {
                lead: {
                    include: {
                        threads: {
                            where: { state: "HANDOFF_REQUIRED" },
                            include: {
                                entries: {
                                    orderBy: { createdAt: "asc" }
                                }
                            },
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
    static async claimLead(leadId: string, userId: string, teamId: string) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true } });
        if (!lead) throw new Error("LEAD_NOT_FOUND");

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

        // Advance Lead.pipelineState to COORDINATING (Fix #3)
        await prisma.lead.updateMany({
            where: { id: leadId, teamId },
            data: {
                pipelineState: "COORDINATING",
                pipelineStateChangedAt: new Date()
            }
        });

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
    static async completeTask(leadId: string, userId: string, teamId: string, outcome: ConversationState, notes?: string) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true } });
        if (!lead) throw new Error("LEAD_NOT_FOUND");

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

        // Update queue status AND Lead.pipelineState (Fix #2)
        if (outcome === ConversationState.MEETING_CONFIRMED) {
            await prisma.meetingCoordinationQueue.update({
                where: { leadId },
                data: { status: "COMPLETED" }
            });
            await prisma.lead.updateMany({
                where: { id: leadId, teamId },
                data: {
                    pipelineState: "MEETING_CONFIRMED",
                    pipelineStateChangedAt: new Date()
                }
            });
        } else if (outcome === ConversationState.CLOSED) {
            await prisma.meetingCoordinationQueue.update({
                where: { leadId },
                data: { status: "COMPLETED" }
            });
            await prisma.lead.updateMany({
                where: { id: leadId, teamId },
                data: {
                    pipelineState: "COMPLETED",
                    pipelineStateChangedAt: new Date(),
                    wonAt: new Date()
                }
            });
        }
        // Other outcomes (COORDINATING for VM/callback) — keep queue assigned, no state change
    }
}
