import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaignSequence: {},
    sequenceStep: { findFirst: vi.fn(), findUnique: vi.fn() },
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
vi.mock("@/services/WhatsAppService", () => ({
    WhatsAppService: { sendMessage: vi.fn() },
}));
vi.mock("@/modules/whatsapp/ConsentService", () => ({
    ConsentService: { validateConsent: vi.fn() },
}));
vi.mock("@/modules/whatsapp/TemplateGuard", () => ({
    TemplateGuard: { validateMessage: vi.fn(), recordMessageSent: vi.fn() },
}));
vi.mock("@/modules/whatsapp/wabaCredentials", () => ({
    getTeamWabaConfig: vi.fn(),
}));
vi.mock("@/modules/analytics/service/PipelineService", () => ({
    PipelineService: { createTask: vi.fn() },
}));

import { SequenceService } from "../sequenceService";
import { WhatsAppService } from "@/services/WhatsAppService";
import { ConsentService } from "@/modules/whatsapp/ConsentService";
import { TemplateGuard } from "@/modules/whatsapp/TemplateGuard";
import { getTeamWabaConfig } from "@/modules/whatsapp/wabaCredentials";
import { PipelineService } from "@/modules/analytics/service/PipelineService";

function baseRun(overrides: any = {}) {
    return {
        id: "run-1",
        teamId: "team-1",
        leadId: "lead-1",
        enrollmentId: "enrollment-1",
        campaignId: "campaign-1",
        step: { stepType: "WHATSAPP", body: "Hi there" },
        enrollment: {
            lead: { id: "lead-1", phone: "+15550001", whatsappConsent: true, status: "NEW", pipelineState: "COLD" },
            sequence: {},
            campaign: { ownerId: "user-1" },
        },
        ...overrides,
    };
}

describe("SequenceService.executeRun - whatsapp step", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        (ConsentService.validateConsent as any).mockResolvedValue({ hasConsent: true });
        (TemplateGuard.validateMessage as any).mockResolvedValue({ isValid: true, requiresTemplate: false });
        (TemplateGuard.recordMessageSent as any).mockResolvedValue(undefined);
        (getTeamWabaConfig as any).mockResolvedValue({ phoneNumberId: "pn-1", accessToken: "token-1" });
        (WhatsAppService.sendMessage as any).mockResolvedValue(true);
        (PipelineService.createTask as any).mockResolvedValue({});
    });

    it("fails non-retryably when the lead has no phone", async () => {
        const run = baseRun({ enrollment: { ...baseRun().enrollment, lead: { id: "lead-1", phone: null, whatsappConsent: true } } });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result).toEqual({ runId: "run-1", status: "FAILED", errorCode: "MISSING_PHONE" });
        expect(WhatsAppService.sendMessage).not.toHaveBeenCalled();
    });

    it("skips the step without exiting the enrollment when consent is missing", async () => {
        const run = baseRun({
            enrollment: { ...baseRun().enrollment, lead: { id: "lead-1", phone: "+15550001", whatsappConsent: false } },
        });
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).toBe("SKIPPED_NO_CONSENT");
        expect(mockDb.sequenceEnrollment.update).not.toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "EXITED" }) })
        );
        expect(WhatsAppService.sendMessage).not.toHaveBeenCalled();
    });

    it("sends automatically and advances the lead when the team has a WABA configured", async () => {
        const run = baseRun();
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const { advanceLeadAfterEmailSent } = await import("@/lib/crm/leadStageTransitions");
        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(WhatsAppService.sendMessage).toHaveBeenCalledWith("lead-1", "Hi there", false, "+15550001", {
            phoneNumberId: "pn-1",
            accessToken: "token-1",
        });
        expect(TemplateGuard.recordMessageSent).toHaveBeenCalledWith("lead-1", "Hi there", false);
        expect(advanceLeadAfterEmailSent).toHaveBeenCalled();
        expect(result.status).toBe("SENT");
        expect(PipelineService.createTask).not.toHaveBeenCalled();
    });

    it("falls back to a human task when the team has no WABA configured", async () => {
        (getTeamWabaConfig as any).mockResolvedValue(null);
        const run = baseRun();
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(WhatsAppService.sendMessage).not.toHaveBeenCalled();
        expect(PipelineService.createTask).toHaveBeenCalledWith(
            expect.objectContaining({ teamId: "team-1", userId: "user-1", leadId: "lead-1" })
        );
        expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
    });

    it("falls back to a human task when a template is required", async () => {
        (TemplateGuard.validateMessage as any).mockResolvedValue({ isValid: false, requiresTemplate: true, reason: "First message must use approved template" });
        const run = baseRun();
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(run);

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(WhatsAppService.sendMessage).not.toHaveBeenCalled();
        expect(PipelineService.createTask).toHaveBeenCalled();
        expect(result.status).toBe("AWAITING_MANUAL_REVIEW");
    });
});
