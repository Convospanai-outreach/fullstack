import crypto from "crypto";
import { prisma, type TransactionClient } from "@/lib/db";
import { JobQueue, type JobType } from "@/lib/queue";

export type OutboxStatus = "PENDING" | "PROCESSING" | "RELAYED" | "FAILED";

export interface OutboxPublishInput {
    teamId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, any>;
    idempotencyKey: string;
}

export class OutboxService {
    /**
     * Publishes an event to the Outbox table within an existing database transaction.
     * Guaranteed atomic with business table operations.
     */
    static async publishEvent(
        input: OutboxPublishInput,
        client: TransactionClient | typeof prisma = prisma
    ) {
        if (!input.teamId) throw new Error("teamId is required for outbox events");
        if (!input.eventType) throw new Error("eventType is required for outbox events");
        if (!input.idempotencyKey) throw new Error("idempotencyKey is required for outbox events");

        try {
            if (!client?.outboxEvent?.create) {
                return null;
            }
            return await client.outboxEvent.create({
                data: {
                    teamId: input.teamId,
                    eventType: input.eventType,
                    aggregateType: input.aggregateType,
                    aggregateId: input.aggregateId,
                    payload: input.payload || {},
                    idempotencyKey: input.idempotencyKey,
                    status: "PENDING",
                    version: 1,
                },
            });
        } catch (error: any) {
            // Handle duplicate idempotency key gracefully
            if (error?.code === "P2002") {
                const existing = await client.outboxEvent.findUnique({
                    where: { idempotencyKey: input.idempotencyKey },
                });
                if (existing) return existing;
            }
            throw error;
        }
    }

    /**
     * Maps an outbox event to its corresponding JobQueue job type and payload.
     */
    static mapEventToJob(event: {
        eventType: string;
        aggregateType: string;
        aggregateId: string;
        teamId: string;
        payload: any;
    }): { type: JobType; payload: Record<string, any> } {
        const p = event.payload || {};

        switch (event.eventType) {
            case "SEQUENCE_STEP_COMPLETED":
                return {
                    type: "sequence_execution",
                    payload: {
                        enrollmentId: p.enrollmentId || event.aggregateId,
                        teamId: event.teamId,
                        sequenceId: p.sequenceId,
                    },
                };

            case "LANDING_LEAD_CREATED":
            case "FUNNEL_LEAD_SUBMITTED":
                return {
                    type: "lead_scoring",
                    payload: {
                        teamId: event.teamId,
                        leadId: event.aggregateId,
                    },
                };

            case "PAYMENT_CAPTURED":
                return {
                    type: "workflow_step",
                    payload: {
                        teamId: event.teamId,
                        eventType: "PAYMENT_CAPTURED",
                        paymentId: event.aggregateId,
                        credits: p.credits,
                        userId: p.userId,
                    },
                };

            default:
                return {
                    type: "event_processing",
                    payload: {
                        teamId: event.teamId,
                        eventType: event.eventType,
                        aggregateType: event.aggregateType,
                        aggregateId: event.aggregateId,
                        ...p,
                    },
                };
        }
    }

    /**
     * Relays a single outbox event to the JobQueue and marks it RELAYED.
     */
    static async relaySingleEvent(eventId: string, version: number) {
        const event = await prisma.outboxEvent.findUnique({
            where: { id: eventId },
        });

        if (!event || event.status === "RELAYED") {
            return false;
        }

        try {
            const { type, payload } = this.mapEventToJob(event);
            const jobPayload = { ...payload, correlationId: `outbox_${event.id}` };

            await JobQueue.enqueue(type, jobPayload, {
                teamId: event.teamId,
                idempotencyKey: `outbox_relay_${event.idempotencyKey}`,
            });

            await prisma.outboxEvent.updateMany({
                where: { id: event.id, version },
                data: {
                    status: "RELAYED",
                    processedAt: new Date(),
                    version: version + 1,
                    error: null,
                },
            });

            return true;
        } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : "Outbox relay error";
            await prisma.outboxEvent.updateMany({
                where: { id: event.id, version },
                data: {
                    status: "FAILED",
                    error: errMsg,
                    version: version + 1,
                },
            });
            return false;
        }
    }

    /**
     * Scans for pending outbox events, claims them, and relays them to the JobQueue.
     * Concurrency-safe via versioned updates.
     * Includes retryable FAILED events (up to MAX_RETRIES) with backoff.
     */
    static async relayPendingEvents(batchSize: number = 50): Promise<number> {
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes for stuck PROCESSING
        const retryThreshold = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute backoff for FAILED
        const MAX_RETRIES = 5;

        // Find candidate events: PENDING, stuck PROCESSING, or retryable FAILED
        const candidates = await prisma.outboxEvent.findMany({
            where: {
                OR: [
                    { status: "PENDING" },
                    { status: "PROCESSING", createdAt: { lte: staleThreshold } },
                    { status: "FAILED", version: { lte: MAX_RETRIES }, createdAt: { lte: retryThreshold } },
                ],
            },
            orderBy: { createdAt: "asc" },
            take: batchSize,
        });

        if (candidates.length === 0) return 0;

        let relayedCount = 0;

        for (const candidate of candidates) {
            const nextVersion = (candidate.version ?? 0) + 1;

            // Atomically claim the event
            const claim = await prisma.outboxEvent.updateMany({
                where: {
                    id: candidate.id,
                    version: candidate.version,
                    status: { in: ["PENDING", "PROCESSING", "FAILED"] },
                },
                data: {
                    status: "PROCESSING",
                    version: nextVersion,
                },
            });

            if (claim.count === 0) {
                // Another worker claimed it
                continue;
            }

            const success = await this.relaySingleEvent(candidate.id, nextVersion);
            if (success) {
                relayedCount++;
            }
        }

        return relayedCount;
    }
}
