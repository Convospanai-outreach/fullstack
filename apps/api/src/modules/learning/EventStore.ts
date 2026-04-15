import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { JobQueue } from "@/lib/queue";

export enum SystemEventType {
    USER = "USER",
    AI = "AI",
    ESP = "ESP", // Email Service Provider
    SYSTEM = "SYSTEM",
    AGENT = "AGENT" // Agent autonomous actions
}

export interface EventPayload extends Record<string, any> {
    metadata?: Record<string, any>;
}

export class EventStore {
    /**
     * Records an immutable event and triggers side-effects (Task 2)
     */
    static async record(params: {
        type: SystemEventType;
        name: string;
        teamId: string;
        actorId?: string;
        payload: EventPayload;
    }) {
        const event = await prisma.systemEvent.create({
            data: {
                type: params.type,
                name: params.name,
                teamId: params.teamId,
                actorId: params.actorId || "SYSTEM",
                payload: params.payload as Prisma.InputJsonValue
            }
        });

        // TRIGGER ASYNCHRONOUS PROCESSING (De-coupled for Scalability)
        await JobQueue.enqueue("event_processing", {
            eventId: event.id,
            teamId: event.teamId
        });

        return event;
    }

    /**
     * Entry point for background worker to process event side-effects.
     */
    static async processEventJob(eventId: string) {
        const event = await prisma.systemEvent.findUnique({ where: { id: eventId } });
        if (!event) return;

        // 1. Update RAG weights if it's an outcome event
        if (["REPLY_RECEIVED", "CLICK", "BOUNCE"].includes(event.name)) {
            await this.processOutcomeForRAG(event);
        }

        // 2. Generate narrative audit log (Immutable Trail)
        await this.generateAuditNarrative(event);
    }

    /**
     * Task 1: Re-weight KnowledgeItems based on outcome signals
     */
    private static async processOutcomeForRAG(event: any) {
        const { knowledgeItemId } = event.payload;
        if (!knowledgeItemId) return;

        const weights: Record<string, number> = {
            "REPLY_RECEIVED": 1.0,
            "CLICK": 0.3,
            "BOUNCE": -1.0
        };

        const reward = weights[event.name] || 0.1;

        await prisma.knowledgePerformance.upsert({
            where: { knowledgeItemId },
            update: {
                rewardScore: { increment: reward },
                usageCount: { increment: 1 },
                replies: { increment: event.name === "REPLY_RECEIVED" ? 1 : 0 },
                clicks: { increment: event.name === "CLICK" ? 1 : 0 },
                bounces: { increment: event.name === "BOUNCE" ? 1 : 0 },
                ...(reward > 0 ? { lastSuccessAt: new Date() } : {})
            },
            create: {
                knowledgeItemId,
                rewardScore: reward,
                usageCount: 1,
                replies: event.name === "REPLY_RECEIVED" ? 1 : 0,
                clicks: event.name === "CLICK" ? 1 : 0,
                bounces: event.name === "BOUNCE" ? 1 : 0,
                lastSuccessAt: reward > 0 ? new Date() : null
            }
        });
    }

    /**
     * Task 7: Human-readable Audit Narratives
     */
    private static async generateAuditNarrative(event: any) {
        let narrative = `Event ${event.name} recorded at ${event.timestamp.toISOString()}.`;

        switch (event.name) {
            case "DRAFT_SENT":
            case "DRAFT_GENERATED":
                narrative = `AI generated a outreach draft for lead ${event.payload.leadName}.`;
                break;
            case "LEAD_INGESTED":
                narrative = `Ingested lead ${event.payload.leadEmail} from source ${event.payload.source}.`;
                break;
            case "FEEDBACK_RECEIVED":
                narrative = `User provided feedback (${event.payload.feedbackType}) on generation ${event.payload.generationId}.`;
                break;
            case "ACTION_APPROVED":
                narrative = `Human reviewer approved the automated outreach plan for ${event.payload.entityType}.`;
                break;
            case "REPLY_RECEIVED":
                narrative = `Successful conversion! Received a reply from ${event.payload.leadEmail}.`;
                break;
            // Agent-specific events
            case "AGENT_STATE_TRANSITION":
                narrative = `Agent task ${event.payload.taskId} transitioned from ${event.payload.fromState} to ${event.payload.toState}.`;
                break;
            case "AGENT_TOOL_EXECUTION":
                narrative = `Agent executed tool '${event.payload.toolName}' ${event.payload.success ? 'successfully' : 'with error: ' + event.payload.error}.`;
                break;
            case "AGENT_APPROVAL_REQUESTED":
                narrative = `Agent task ${event.payload.taskId} requested approval for ${event.payload.actionType} (Risk: ${event.payload.riskLevel}).`;
                break;
            case "AGENT_APPROVAL_GRANTED":
                narrative = `Approval granted for agent task ${event.payload.taskId} by ${event.payload.approverId}.`;
                break;
            case "AGENT_APPROVAL_REJECTED":
                narrative = `Approval rejected for agent task ${event.payload.taskId} by ${event.payload.approverId}. Reason: ${event.payload.reason || 'N/A'}.`;
                break;
            case "AGENT_TASK_COMPLETED":
                narrative = `Agent task ${event.payload.taskId} completed ${event.payload.success ? 'successfully' : 'with failure'}.`;
                break;
        }

        // Integrity Hash (Task 7)
        // Implements cryptographic chaining of the audit trail
        const crypto = await import("crypto");
        const hash = crypto.createHash('sha256')
            .update(`${event.id}:${narrative}`)
            .digest('hex');

        await prisma.immutableAudit.create({
            data: {
                eventId: event.id,
                teamId: event.teamId,
                narrative,
                hash
            }
        });
    }
}
