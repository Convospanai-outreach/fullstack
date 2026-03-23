import { prisma } from "@/lib/db";
import { ConversationState, ConversationThread } from "@prisma/client";

export class ConversationService {

    /**
     * Creates a new conversation thread for a lead.
     * Ensures only one active thread exists (optional business rule).
     */
    static async startThread(leadId: string, channel: string = "EMAIL"): Promise<ConversationThread> {
        return await prisma.conversationThread.create({
            data: {
                leadId,
                state: ConversationState.INITIATED,
                channel
            }
        });
    }

    /**
     * Transitions the conversation state enforcing the State Machine rules.
     * 
     * INITIATED -> ENGAGED
     * ENGAGED -> QUALIFIED | CLOSED
     * QUALIFIED -> HANDOFF_REQUIRED
     * HANDOFF_REQUIRED -> COORDINATING
     * COORDINATING -> MEETING_CONFIRMED | CLOSED
     */
    static async transitionState(threadId: string, newState: ConversationState, reason?: string) {
        const thread = await prisma.conversationThread.findUnique({
            where: { id: threadId },
            include: { lead: { select: { teamId: true } } }
        });
        if (!thread) throw new Error("Thread not found");

        if (!this.isValidTransition(thread.state, newState)) {
            throw new Error(`Invalid state transition from ${thread.state} to ${newState}`);
        }

        // Update state
        const updated = await prisma.conversationThread.update({
            where: { id: threadId },
            data: { state: newState }
        });

        // Log the transition (using AuditService effectively)
        // We import dynamically to avoid circular deps if any
        if (thread.lead?.teamId) {
            const { AuditService } = await import("@/modules/audit/auditService");
            await AuditService.log(
                thread.lead.teamId,
                null, // System action
                "CONVERSATION_STATE_CHANGE",
                "ConversationThread",
                threadId,
                { oldState: thread.state, newState, reason }
            );
        }

        return updated;
    }

    /**
     * Validates if a transition is allowed based on the enterprise rules.
     */
    private static isValidTransition(current: ConversationState, next: ConversationState): boolean {
        if (current === next) return true; // Idempotent
        if (current === ConversationState.CLOSED) return false; // Terminal state

        switch (current) {
            case ConversationState.INITIATED:
                return next === ConversationState.ENGAGED || next === ConversationState.CLOSED;

            case ConversationState.ENGAGED:
                return next === ConversationState.QUALIFIED || next === ConversationState.CLOSED;

            case ConversationState.QUALIFIED:
                return next === ConversationState.HANDOFF_REQUIRED || next === ConversationState.CLOSED;

            case ConversationState.HANDOFF_REQUIRED:
                // System must assign coordination
                return next === ConversationState.COORDINATING || next === ConversationState.CLOSED;

            case ConversationState.COORDINATING:
                return next === ConversationState.MEETING_CONFIRMED || next === ConversationState.CLOSED;

            case ConversationState.MEETING_CONFIRMED:
                return next === ConversationState.CLOSED;

            default:
                return false;
        }
    }

    /**
     * Appends an entry to the thread.
     * "History is immutable" - logic handled by DB append-only, but service enforces structure.
     */
    static async addEntry(threadId: string, leadId: string, role: string, content: string) {
        // Check if thread is closed?
        const thread = await prisma.conversationThread.findUnique({ where: { id: threadId } });
        if (thread?.state === ConversationState.CLOSED) {
            throw new Error("Cannot add entries to a closed conversation");
        }

        return await prisma.conversationEntry.create({
            data: {
                leadId,
                conversationThreadId: threadId,
                role,
                content
            }
        });
    }
}
