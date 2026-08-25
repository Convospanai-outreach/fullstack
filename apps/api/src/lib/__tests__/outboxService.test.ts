import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJobQueue } = vi.hoisted(() => ({
    mockPrisma: {
        outboxEvent: {
            create: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            updateMany: vi.fn(),
        },
    },
    mockJobQueue: {
        enqueue: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: mockJobQueue }));

describe("OutboxService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("publishEvent", () => {
        it("publishes an event successfully with status PENDING", async () => {
            const mockEvent = {
                id: "event-1",
                teamId: "team-1",
                eventType: "PAYMENT_CAPTURED",
                aggregateType: "CreditTransaction",
                aggregateId: "pay-1",
                payload: { credits: 100 },
                idempotencyKey: "pay-1-key",
                status: "PENDING",
                version: 1,
            };
            mockPrisma.outboxEvent.create.mockResolvedValue(mockEvent);

            const { OutboxService } = await import("@/lib/outboxService");
            const result = await OutboxService.publishEvent({
                teamId: "team-1",
                eventType: "PAYMENT_CAPTURED",
                aggregateType: "CreditTransaction",
                aggregateId: "pay-1",
                payload: { credits: 100 },
                idempotencyKey: "pay-1-key",
            });

            expect(result).toEqual(mockEvent);
            expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    teamId: "team-1",
                    eventType: "PAYMENT_CAPTURED",
                    status: "PENDING",
                    version: 1,
                }),
            });
        });

        it("returns existing event when P2002 duplicate idempotencyKey is encountered", async () => {
            const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
            mockPrisma.outboxEvent.create.mockRejectedValue(conflict);
            const existingEvent = {
                id: "event-existing",
                idempotencyKey: "pay-1-key",
                status: "RELAYED",
            };
            mockPrisma.outboxEvent.findUnique.mockResolvedValue(existingEvent);

            const { OutboxService } = await import("@/lib/outboxService");
            const result = await OutboxService.publishEvent({
                teamId: "team-1",
                eventType: "PAYMENT_CAPTURED",
                aggregateType: "CreditTransaction",
                aggregateId: "pay-1",
                payload: { credits: 100 },
                idempotencyKey: "pay-1-key",
            });

            expect(result).toEqual(existingEvent);
        });

        it("validates required fields and throws", async () => {
            const { OutboxService } = await import("@/lib/outboxService");
            await expect(
                OutboxService.publishEvent({
                    teamId: "",
                    eventType: "TEST",
                    aggregateType: "Test",
                    aggregateId: "1",
                    payload: {},
                    idempotencyKey: "k1",
                })
            ).rejects.toThrow("teamId is required");
        });
    });

    describe("mapEventToJob", () => {
        it("maps SEQUENCE_STEP_COMPLETED to sequence_execution", async () => {
            const { OutboxService } = await import("@/lib/outboxService");
            const mapped = OutboxService.mapEventToJob({
                eventType: "SEQUENCE_STEP_COMPLETED",
                aggregateType: "SequenceStepRun",
                aggregateId: "run-1",
                teamId: "team-1",
                payload: { enrollmentId: "enroll-1", sequenceId: "seq-1" },
            });

            expect(mapped.type).toBe("sequence_execution");
            expect(mapped.payload).toEqual({
                enrollmentId: "enroll-1",
                teamId: "team-1",
                sequenceId: "seq-1",
            });
        });

        it("maps LANDING_LEAD_CREATED to landing_lead_intake", async () => {
            const { OutboxService } = await import("@/lib/outboxService");
            const mapped = OutboxService.mapEventToJob({
                eventType: "LANDING_LEAD_CREATED",
                aggregateType: "LandingLead",
                aggregateId: "lead-1",
                teamId: "team-1",
                payload: {},
            });

            expect(mapped.type).toBe("landing_lead_intake");
            expect(mapped.payload).toEqual({
                teamId: "team-1",
                landingLeadId: "lead-1",
            });
        });
    });

    describe("relayPendingEvents", () => {
        it("claims and relays pending events", async () => {
            const candidate = {
                id: "ev-1",
                teamId: "team-1",
                eventType: "SEQUENCE_STEP_COMPLETED",
                aggregateType: "SequenceStepRun",
                aggregateId: "run-1",
                payload: { enrollmentId: "en-1" },
                idempotencyKey: "key-1",
                version: 1,
                status: "PENDING",
            };

            mockPrisma.outboxEvent.findMany.mockResolvedValue([candidate]);
            mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.outboxEvent.findUnique.mockResolvedValue(candidate);
            mockJobQueue.enqueue.mockResolvedValue({ id: "job-1" });

            const { OutboxService } = await import("@/lib/outboxService");
            const relayedCount = await OutboxService.relayPendingEvents(10);

            expect(relayedCount).toBe(1);
            expect(mockJobQueue.enqueue).toHaveBeenCalledWith(
                "sequence_execution",
                expect.objectContaining({ enrollmentId: "en-1", teamId: "team-1" }),
                { teamId: "team-1", idempotencyKey: "outbox_relay_key-1" }
            );
        });

        it("claims and retries retryable FAILED events", async () => {
            const failedCandidate = {
                id: "ev-failed",
                teamId: "team-1",
                eventType: "LANDING_LEAD_CREATED",
                aggregateType: "LandingLead",
                aggregateId: "lead-99",
                payload: {},
                idempotencyKey: "key-failed",
                version: 2,
                status: "FAILED",
                updatedAt: new Date(Date.now() - 120000),
            };

            mockPrisma.outboxEvent.findMany.mockResolvedValue([failedCandidate]);
            mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.outboxEvent.findUnique.mockResolvedValue(failedCandidate);
            mockJobQueue.enqueue.mockResolvedValue({ id: "job-retry" });

            const { OutboxService } = await import("@/lib/outboxService");
            const relayedCount = await OutboxService.relayPendingEvents(10);

            expect(relayedCount).toBe(1);
            expect(mockJobQueue.enqueue).toHaveBeenCalledWith(
                "landing_lead_intake",
                expect.objectContaining({ landingLeadId: "lead-99", teamId: "team-1" }),
                { teamId: "team-1", idempotencyKey: "outbox_relay_key-failed" }
            );
        });

        it("returns 0 when no events are pending", async () => {
            mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

            const { OutboxService } = await import("@/lib/outboxService");
            const relayedCount = await OutboxService.relayPendingEvents(10);

            expect(relayedCount).toBe(0);
        });
    });
});
