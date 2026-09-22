import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaignSequence: {},
    sequenceStep: { findFirst: vi.fn(), findUnique: vi.fn() },
    sequenceEdge: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
    sequenceStepRun: { findUnique: vi.fn(), update: vi.fn() },
    sequenceEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    lead: { findUnique: vi.fn() },
    team: { findUnique: vi.fn(), update: vi.fn() },
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
vi.mock("@/services/WhatsAppService", () => ({ WhatsAppService: { sendMessage: vi.fn() } }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({ ConsentService: { validateConsent: vi.fn() } }));
vi.mock("@/modules/whatsapp/TemplateGuard", () => ({ TemplateGuard: { validateMessage: vi.fn(), recordMessageSent: vi.fn() } }));
vi.mock("@/modules/whatsapp/wabaCredentials", () => ({ getTeamWabaConfig: vi.fn() }));
vi.mock("@/modules/analytics/service/PipelineService", () => ({
    PipelineService: { createTask: vi.fn() },
}));
vi.mock("@/modules/caller/CallerService", () => ({
    CallerService: { ensureQueueEntry: vi.fn() },
}));
vi.mock("@/linkedin/extension-bridge", () => ({
    enqueueExtensionTask: vi.fn().mockResolvedValue({ id: "ext-job-1", created: true }),
}));

import { SequenceService } from "../sequenceService";
import { PipelineService } from "@/modules/analytics/service/PipelineService";
import { CallerService } from "@/modules/caller/CallerService";
import { enqueueExtensionTask } from "@/linkedin/extension-bridge";

function baseRun(overrides: any = {}) {
    return {
        id: "run-1",
        teamId: "team-1",
        leadId: "lead-1",
        enrollmentId: "enrollment-1",
        campaignId: "campaign-1",
        step: { stepType: "LI_INVITE", body: "Would love to connect" },
        enrollment: {
            lead: { id: "lead-1", linkedIn: "https://linkedin.com/in/lead-1", phone: "+15550001", status: "NEW", pipelineState: "COLD" },
            sequence: {},
            campaign: { ownerId: "user-1" },
        },
        ...overrides,
    };
}

describe("SequenceService.executeRun - LinkedIn step types", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        (PipelineService.createTask as any).mockResolvedValue({});
    });

    it("fails non-retryably when the lead has no LinkedIn URL", async () => {
        const run = baseRun({ enrollment: { ...baseRun().enrollment, lead: { id: "lead-1", linkedIn: null } } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result).toEqual({ runId: "run-1", status: "FAILED", errorCode: "MISSING_LINKEDIN_URL" });
        expect(PipelineService.createTask).not.toHaveBeenCalled();
    });

    it.each(["LI_INVITE", "LI_CHAT", "LI_VISIT", "LI_WITHDRAW", "LI_VOICE", "CHAT_MESSAGE", "VISIT_PROFILE"])(
        "hands %s off to a human task instead of failing as UNSUPPORTED_STEP_TYPE",
        async (stepType) => {
            const run = baseRun({ step: { stepType, body: "Hi!" } });
            mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

            const result = await SequenceService.executeRun({ runId: "run-1" });

            expect(PipelineService.createTask).toHaveBeenCalledWith(
                expect.objectContaining({ teamId: "team-1", userId: "user-1", leadId: "lead-1" })
            );
            expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
        }
    );

    it("also enqueues an OPEN_PROFILE extension task (idempotent, best-effort) alongside the manual task", async () => {
        const run = baseRun({ step: { stepType: "LI_INVITE", body: "Hi!" } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        await SequenceService.executeRun({ runId: "run-1" });

        expect(enqueueExtensionTask).toHaveBeenCalledWith(
            expect.objectContaining({
                teamId: "team-1",
                type: "OPEN_PROFILE",
                idempotencyKey: "ext_openprofile_run-1",
                payload: expect.objectContaining({ profileUrl: "https://linkedin.com/in/lead-1", leadId: "lead-1" }),
            })
        );
    });

    it("does not fail the run when enqueuing the extension task throws (best-effort)", async () => {
        (enqueueExtensionTask as any).mockRejectedValueOnce(new Error("db down"));
        const run = baseRun({ step: { stepType: "LI_INVITE", body: "Hi!" } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
    });

    it.each(["LI_CHAT", "CHAT_MESSAGE"])(
        "enqueues an INSERT_DRAFT task for %s steps that carry a drafted body",
        async (stepType) => {
            const run = baseRun({ step: { stepType, body: "Hey there, quick note." } });
            mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

            await SequenceService.executeRun({ runId: "run-1" });

            expect(enqueueExtensionTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    teamId: "team-1",
                    type: "INSERT_DRAFT",
                    idempotencyKey: "ext_insertdraft_run-1",
                    payload: expect.objectContaining({
                        profileUrl: "https://linkedin.com/in/lead-1",
                        leadId: "lead-1",
                        body: "Hey there, quick note.",
                    }),
                })
            );
        }
    );

    it("falls back to OPEN_PROFILE for a chat step with no drafted body", async () => {
        const run = baseRun({ step: { stepType: "LI_CHAT", body: "" } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        await SequenceService.executeRun({ runId: "run-1" });

        expect(enqueueExtensionTask).toHaveBeenCalledWith(
            expect.objectContaining({ type: "OPEN_PROFILE", idempotencyKey: "ext_openprofile_run-1" })
        );
    });
});

describe("SequenceService.executeRun - CALL step", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        (CallerService.ensureQueueEntry as any).mockResolvedValue(undefined);
    });

    it("fails non-retryably when the lead has no phone number", async () => {
        const run = baseRun({
            step: { stepType: "CALL", body: "Follow up" },
            enrollment: { ...baseRun().enrollment, lead: { id: "lead-1", phone: null } },
        });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result).toEqual({ runId: "run-1", status: "FAILED", errorCode: "MISSING_PHONE" });
        expect(CallerService.ensureQueueEntry).not.toHaveBeenCalled();
    });

    it("queues the lead for a human caller and marks the run awaiting manual review", async () => {
        const run = baseRun({ step: { stepType: "CALL", body: "Follow up" } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(CallerService.ensureQueueEntry).toHaveBeenCalledWith("lead-1");
        expect(mockDb.sequenceStepRun.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "run-1" }, data: expect.objectContaining({ status: "AWAITING_MANUAL_REVIEW" }) })
        );
        expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
    });
});
