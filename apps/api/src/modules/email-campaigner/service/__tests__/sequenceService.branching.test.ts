import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaignSequence: {},
    sequenceStep: { findFirst: vi.fn(), findUnique: vi.fn() },
    sequenceEdge: { count: vi.fn(), findFirst: vi.fn() },
    sequenceStepRun: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    sequenceEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    lead: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner", () => ({ emailService: {} }));
vi.mock("../googleMailboxService", () => ({
    assertMailboxCanSend: vi.fn(),
    isSuppressed: vi.fn(),
}));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailSent: vi.fn().mockResolvedValue({ leadStageChanged: true }),
}));

import { SequenceService } from "../sequenceService";

function conditionRun(overrides: any = {}) {
    return {
        id: "run-1",
        teamId: "team-1",
        leadId: "lead-1",
        enrollmentId: "enrollment-1",
        campaignId: "campaign-1",
        sequenceStepId: "step-condition",
        step: { id: "step-condition", stepType: "CONDITION", stepOrder: 2, body: JSON.stringify({ hasEmail: true }) },
        enrollment: {
            id: "enrollment-1",
            teamId: "team-1",
            sequenceId: "seq-1",
            leadId: "lead-1",
            campaignId: "campaign-1",
            mailboxId: "mailbox-1",
            lead: { id: "lead-1", email: "lead@example.com", status: "NEW", pipelineState: "COLD" },
            sequence: { id: "seq-1", timezone: "UTC" },
            campaign: { ownerId: "user-1" },
        },
        ...overrides,
    };
}

describe("SequenceService.executeRun - condition branching via SequenceEdge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceStepRun.findFirst.mockResolvedValue(null);
        mockDb.sequenceStepRun.create.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});
    });

    it("routes to the 'yes' edge target when the condition passes", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(conditionRun());
        mockDb.sequenceEdge.count.mockResolvedValue(2);
        mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
            if (where.sourceHandle === "yes") return Promise.resolve({ targetStepId: "step-yes" });
            return Promise.resolve(null);
        });
        mockDb.sequenceStep.findUnique.mockResolvedValue({ id: "step-yes", status: "ACTIVE", stepOrder: 5, delayDays: 0, delayHours: 0 });

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("COMPLETED");
        expect(mockDb.sequenceEdge.findFirst).toHaveBeenCalledWith({ where: { sourceStepId: "step-condition", sourceHandle: "yes" } });
        expect(mockDb.sequenceStepRun.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sequenceStepId: "step-yes" }) })
        );
    });

    it("routes to the 'no' edge target when the condition fails", async () => {
        const run = conditionRun({
            enrollment: { ...conditionRun().enrollment, lead: { id: "lead-1", email: null, status: "NEW", pipelineState: "COLD" } },
        });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);
        mockDb.sequenceEdge.count.mockResolvedValue(2);
        mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
            if (where.sourceHandle === "no") return Promise.resolve({ targetStepId: "step-no" });
            return Promise.resolve(null);
        });
        mockDb.sequenceStep.findUnique.mockResolvedValue({ id: "step-no", status: "ACTIVE", stepOrder: 3, delayDays: 0, delayHours: 0 });

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("SKIPPED_CONDITION");
        expect(mockDb.sequenceEdge.findFirst).toHaveBeenCalledWith({ where: { sourceStepId: "step-condition", sourceHandle: "no" } });
        expect(mockDb.sequenceStepRun.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sequenceStepId: "step-no" }) })
        );
    });

    it("falls back to the default edge when no 'no' branch is configured", async () => {
        const run = conditionRun({
            enrollment: { ...conditionRun().enrollment, lead: { id: "lead-1", email: null, status: "NEW", pipelineState: "COLD" } },
        });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);
        mockDb.sequenceEdge.count.mockResolvedValue(1);
        mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
            if (where.sourceHandle === "default") return Promise.resolve({ targetStepId: "step-default" });
            return Promise.resolve(null);
        });
        mockDb.sequenceStep.findUnique.mockResolvedValue({ id: "step-default", status: "ACTIVE", stepOrder: 3, delayDays: 0, delayHours: 0 });

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("SKIPPED_CONDITION");
        expect(mockDb.sequenceStepRun.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sequenceStepId: "step-default" }) })
        );
    });

    it("falls back to legacy stepOrder traversal when the sequence has zero edges", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(conditionRun());
        mockDb.sequenceEdge.count.mockResolvedValue(0);
        mockDb.sequenceStep.findFirst.mockResolvedValue({ id: "step-legacy-next", status: "ACTIVE", stepOrder: 3, delayDays: 0, delayHours: 0 });

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("COMPLETED");
        expect(mockDb.sequenceEdge.findFirst).not.toHaveBeenCalled();
        expect(mockDb.sequenceStep.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ sequenceId: "seq-1", stepOrder: { gt: 2 } }) })
        );
        expect(mockDb.sequenceStepRun.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sequenceStepId: "step-legacy-next" }) })
        );
    });

    it("transparently skips an inactive edge target and continues down its default edge", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(conditionRun());
        mockDb.sequenceEdge.count.mockResolvedValue(2);
        mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
            if (where.sourceStepId === "step-condition" && where.sourceHandle === "yes") return Promise.resolve({ targetStepId: "step-inactive" });
            if (where.sourceStepId === "step-inactive" && where.sourceHandle === "default") return Promise.resolve({ targetStepId: "step-active-after" });
            return Promise.resolve(null);
        });
        mockDb.sequenceStep.findUnique.mockImplementation(({ where }: any) => {
            if (where.id === "step-inactive") return Promise.resolve({ id: "step-inactive", status: "PAUSED", stepOrder: 4, delayDays: 0, delayHours: 0 });
            if (where.id === "step-active-after") return Promise.resolve({ id: "step-active-after", status: "ACTIVE", stepOrder: 6, delayDays: 0, delayHours: 0 });
            return Promise.resolve(null);
        });

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("COMPLETED");
        expect(mockDb.sequenceStepRun.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sequenceStepId: "step-active-after" }) })
        );
    });
});
