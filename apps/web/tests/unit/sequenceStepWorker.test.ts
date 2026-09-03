import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
  sequenceStepRun: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  sequenceStep: { findUnique: vi.fn() },
  sequenceEdge: { count: vi.fn(), findFirst: vi.fn() },
  sequenceEnrollment: { update: vi.fn() },
  lead: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

const mockEnqueue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));

import { handleSequenceStep } from "@/workers/handlers/sequence-step-worker";

const basePayload = { enrollmentId: "enrollment-1", sequenceStepId: "step-1", teamId: "team-1", leadId: "lead-1" };

describe("handleSequenceStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.sequenceStepRun.update.mockResolvedValue({});
    mockDb.sequenceStepRun.findFirst.mockResolvedValue({ id: "run-1", campaignId: "campaign-1", mailboxId: "mailbox-1" });
    mockDb.sequenceEnrollment.update.mockResolvedValue({});
  });

  it("enqueues an email_sending job for an EMAIL step and advances via the default edge", async () => {
    mockDb.sequenceStep.findUnique.mockResolvedValue({
      id: "step-1", sequenceId: "seq-1", stepType: "EMAIL", stepOrder: 1, subject: "Hi", body: "Body",
    });
    mockDb.sequenceEdge.count.mockResolvedValue(1);
    mockDb.sequenceEdge.findFirst.mockResolvedValue({ targetStepId: "step-2" });
    mockDb.sequenceStep.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === "step-1") return Promise.resolve({ id: "step-1", sequenceId: "seq-1", stepType: "EMAIL", stepOrder: 1, subject: "Hi", body: "Body" });
      if (where.id === "step-2") return Promise.resolve({ id: "step-2", status: "ACTIVE", stepOrder: 2, delayDays: 0, delayHours: 1 });
      return Promise.resolve(null);
    });

    const result = await handleSequenceStep(basePayload);

    expect(mockEnqueue).toHaveBeenCalledWith("email_sending", expect.objectContaining({ leadId: "lead-1", subject: "Hi", body: "Body" }));
    expect(result.status).toBe("COMPLETED");
    expect(mockDb.sequenceEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStepOrder: 1 }) })
    );
  });

  it("routes a passing CONDITION step down the 'yes' edge", async () => {
    mockDb.sequenceStep.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === "step-1") return Promise.resolve({ id: "step-1", sequenceId: "seq-1", stepType: "CONDITION", stepOrder: 1, body: JSON.stringify({ hasEmail: true }) });
      if (where.id === "step-yes") return Promise.resolve({ id: "step-yes", status: "ACTIVE", stepOrder: 3, delayDays: 0, delayHours: 0 });
      return Promise.resolve(null);
    });
    mockDb.lead.findUnique.mockResolvedValue({ id: "lead-1", email: "lead@example.com" });
    mockDb.sequenceEdge.count.mockResolvedValue(2);
    mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
      if (where.sourceHandle === "yes") return Promise.resolve({ targetStepId: "step-yes" });
      return Promise.resolve(null);
    });

    const result = await handleSequenceStep(basePayload);

    expect(result.status).toBe("COMPLETED");
    expect(mockDb.sequenceEdge.findFirst).toHaveBeenCalledWith({ where: { sourceStepId: "step-1", sourceHandle: "yes" } });
  });

  it("routes a failing CONDITION step down the 'no' edge", async () => {
    mockDb.sequenceStep.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === "step-1") return Promise.resolve({ id: "step-1", sequenceId: "seq-1", stepType: "CONDITION", stepOrder: 1, body: JSON.stringify({ hasEmail: true }) });
      if (where.id === "step-no") return Promise.resolve({ id: "step-no", status: "ACTIVE", stepOrder: 2, delayDays: 0, delayHours: 0 });
      return Promise.resolve(null);
    });
    mockDb.lead.findUnique.mockResolvedValue({ id: "lead-1", email: null });
    mockDb.sequenceEdge.count.mockResolvedValue(2);
    mockDb.sequenceEdge.findFirst.mockImplementation(({ where }: any) => {
      if (where.sourceHandle === "no") return Promise.resolve({ targetStepId: "step-no" });
      return Promise.resolve(null);
    });

    const result = await handleSequenceStep(basePayload);

    expect(result.status).toBe("SKIPPED_CONDITION");
    expect(mockDb.sequenceEdge.findFirst).toHaveBeenCalledWith({ where: { sourceStepId: "step-1", sourceHandle: "no" } });
  });

  it("puts the enrollment into MANUAL_REVIEW for a MANUAL_REVIEW step", async () => {
    mockDb.sequenceStep.findUnique.mockResolvedValue({ id: "step-1", sequenceId: "seq-1", stepType: "MANUAL_REVIEW", stepOrder: 1 });

    const result = await handleSequenceStep(basePayload);

    expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
    expect(mockDb.sequenceEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "MANUAL_REVIEW", nextRunAt: null }) })
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("falls back to legacy stepOrder traversal when the sequence has zero edges", async () => {
    mockDb.sequenceStep.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === "step-1") return Promise.resolve({ id: "step-1", sequenceId: "seq-1", stepType: "DELAY", stepOrder: 1 });
      return Promise.resolve(null);
    });
    mockDb.sequenceEdge.count.mockResolvedValue(0);
    mockDb.sequenceStep.findFirst = vi.fn().mockResolvedValue({ id: "step-legacy", status: "ACTIVE", stepOrder: 2, delayDays: 1, delayHours: 0 });

    const result = await handleSequenceStep(basePayload);

    expect(result.status).toBe("COMPLETED");
    expect(mockDb.sequenceEdge.findFirst).not.toHaveBeenCalled();
    expect(mockDb.sequenceStep.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sequenceId: "seq-1", stepOrder: { gt: 1 } }) })
    );
  });

  it("completes the enrollment when no next step is found", async () => {
    mockDb.sequenceStep.findUnique.mockResolvedValue({ id: "step-1", sequenceId: "seq-1", stepType: "DELAY", stepOrder: 1 });
    mockDb.sequenceEdge.count.mockResolvedValue(0);
    mockDb.sequenceStep.findFirst = vi.fn().mockResolvedValue(null);

    const result = await handleSequenceStep(basePayload);

    expect(result.status).toBe("COMPLETED");
    expect(mockDb.sequenceEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });
});
