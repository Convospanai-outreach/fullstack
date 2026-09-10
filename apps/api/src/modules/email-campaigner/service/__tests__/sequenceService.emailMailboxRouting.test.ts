import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaignSequence: {},
    sequenceStep: { findFirst: vi.fn(), findUnique: vi.fn() },
    sequenceEdge: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
    sequenceStepRun: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    sequenceEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    lead: { findUnique: vi.fn() },
    email: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner", () => ({ emailService: { sendEmail: vi.fn() } }));
vi.mock("../googleMailboxService", () => ({
    assertMailboxCanSend: vi.fn(),
    isSuppressed: vi.fn(),
}));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailSent: vi.fn().mockResolvedValue({ leadStageChanged: true }),
}));

import { SequenceService } from "../sequenceService";
import { emailService } from "@/modules/email-campaigner";
import { assertMailboxCanSend, isSuppressed } from "../googleMailboxService";

function baseRun(overrides: any = {}) {
    return {
        id: "run-1",
        teamId: "team-1",
        leadId: "lead-1",
        enrollmentId: "enrollment-1",
        sequenceStepId: "step-1",
        campaignId: "campaign-1",
        mailboxId: "resend-mailbox-1",
        step: { stepType: "email", subject: "Hi", body: "Following up" },
        enrollment: {
            lead: { id: "lead-1", email: "lead@example.test", status: "NEW", pipelineState: "COLD" },
            sequence: {},
            campaign: { ownerId: "user-1" },
        },
        ...overrides,
    };
}

describe("SequenceService.executeRun - email step sends through the run's assigned mailbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.findFirst.mockResolvedValue(null);
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});
        mockDb.email.findFirst.mockResolvedValue({ id: "email-1" });
        (isSuppressed as any).mockResolvedValue(false);
        (assertMailboxCanSend as any).mockResolvedValue({ ok: true });
        (emailService.sendEmail as any).mockResolvedValue({ success: true, providerId: "resend-message-1", deliveryProvider: "RESEND" });
    });

    it("passes the sequence-assigned mailboxId through to emailService.sendEmail, so a Resend sender selected in the drip builder is actually used", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(baseRun());

        await SequenceService.executeRun({ runId: "run-1", teamId: "team-1" });

        expect(assertMailboxCanSend).toHaveBeenCalledWith("team-1", "resend-mailbox-1");
        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "lead@example.test",
            "Hi",
            "Following up",
            expect.objectContaining({ mailboxId: "resend-mailbox-1" }),
        );
    });

    it("passes mailboxId as undefined when the sequence has no assigned sender (falls back to today's rotation)", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(baseRun({ mailboxId: null }));

        await SequenceService.executeRun({ runId: "run-1", teamId: "team-1" });

        expect(assertMailboxCanSend).not.toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "lead@example.test",
            "Hi",
            "Following up",
            expect.objectContaining({ mailboxId: undefined }),
        );
    });
});
