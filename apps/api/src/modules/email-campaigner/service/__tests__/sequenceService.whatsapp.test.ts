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
vi.mock("@/services/WhatsAppService", () => ({
    WhatsAppService: { sendMessage: vi.fn(), sendTemplate: vi.fn() },
}));
const templates = vi.hoisted(() => ({ checkTemplate: vi.fn() }));
vi.mock("@/modules/whatsapp/whatsappTemplates", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modules/whatsapp/whatsappTemplates")>()),
    checkTemplate: templates.checkTemplate,
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

    describe("template steps (5c-2)", () => {
        const templateRun = (step: any = {}, lead: any = {}) =>
            baseRun({
                step: { stepType: "WHATSAPP", whatsappTemplateName: "guide_ready", whatsappTemplateLanguage: "en_US", body: "{first_name}\nthe  guide", ...step },
                enrollment: { ...baseRun().enrollment, lead: { id: "lead-1", phone: "+91 98765 43210", fullName: "Asha Rao", whatsappConsent: true, status: "NEW", ...lead } },
            });

        beforeEach(() => {
            templates.checkTemplate.mockResolvedValue({ ok: true, variables: 2 });
            (WhatsAppService.sendTemplate as any).mockResolvedValue("wamid.1");
        });

        it("sends the approved template with the cleaned values to the international number", async () => {
            mockDb.sequenceStepRun.findUnique.mockResolvedValue(templateRun());
            const result = await SequenceService.executeRun({ runId: "run-1" });
            expect(templates.checkTemplate).toHaveBeenCalledWith("team-1", "guide_ready", "en_US");
            expect(WhatsAppService.sendTemplate).toHaveBeenCalledWith(
                "919876543210",
                { name: "guide_ready", language: "en_US", values: ["Asha", "the guide"] },
                { phoneNumberId: "pn-1", accessToken: "token-1" },
            );
            expect(TemplateGuard.validateMessage).not.toHaveBeenCalled(); // Meta's approval is the gate
            expect(mockDb.sequenceStepRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerMessageId: "wamid.1" }) }));
            expect(result.status).toBe("SENT");
            expect(PipelineService.createTask).not.toHaveBeenCalled();
        });

        it("still needs consent first", async () => {
            (ConsentService.validateConsent as any).mockResolvedValue({ hasConsent: false });
            mockDb.sequenceStepRun.findUnique.mockResolvedValue(templateRun());
            expect((await SequenceService.executeRun({ runId: "run-1" })).status).toBe("SKIPPED_NO_CONSENT");
            expect(WhatsAppService.sendTemplate).not.toHaveBeenCalled();
        });

        it.each([
            ["a template that isn't approved", () => templates.checkTemplate.mockResolvedValue({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED", reason: "x" }), {}, {}, "WHATSAPP_TEMPLATE_NOT_APPROVED"],
            ["no Business Account id", () => templates.checkTemplate.mockResolvedValue({ ok: false, code: "WHATSAPP_NO_WABA_ID", reason: "x" }), {}, {}, "WHATSAPP_NO_WABA_ID"],
            ["values that don't match the variables", () => templates.checkTemplate.mockResolvedValue({ ok: true, variables: 3 }), {}, {}, "WHATSAPP_TEMPLATE_VALUES"],
            ["a phone number without a country code", () => undefined, {}, { phone: "98765 43210" }, "WHATSAPP_PHONE_NOT_INTERNATIONAL"],
            ["no template language", () => undefined, { whatsappTemplateLanguage: null }, {}, "WHATSAPP_TEMPLATE_NO_LANGUAGE"],
            ["WhatsApp disconnected", () => (getTeamWabaConfig as any).mockResolvedValue(null), {}, {}, "WHATSAPP_NOT_CONNECTED"],
        ])("skips just this step and carries on for %s", async (_label, arrange, step, lead, code) => {
            arrange();
            mockDb.sequenceStepRun.findUnique.mockResolvedValue(templateRun(step, lead));
            const result = await SequenceService.executeRun({ runId: "run-1" });
            expect(result).toMatchObject({ status: "SKIPPED_WHATSAPP", errorCode: code });
            expect(WhatsAppService.sendTemplate).not.toHaveBeenCalled();
            expect(PipelineService.createTask).not.toHaveBeenCalled();
            expect(mockDb.sequenceEnrollment.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "MANUAL_REVIEW" }) }));
        });
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
