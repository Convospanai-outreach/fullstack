import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaignSequence: {},
    sequenceStep: { findFirst: vi.fn(), findUnique: vi.fn() },
    sequenceEdge: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
    sequenceStepRun: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    sequenceEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    lead: { findUnique: vi.fn() },
    team: { findUnique: vi.fn(), update: vi.fn() },
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

describe("SequenceService.executeRun - cross-tenant ownership", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.sequenceStepRun.findFirst.mockResolvedValue(null);
        (ConsentService.validateConsent as any).mockResolvedValue({ hasConsent: true });
        (TemplateGuard.validateMessage as any).mockResolvedValue({ isValid: true, requiresTemplate: false });
        (TemplateGuard.recordMessageSent as any).mockResolvedValue(undefined);
        (getTeamWabaConfig as any).mockResolvedValue({ phoneNumberId: "pn-1", accessToken: "token-1" });
        (WhatsAppService.sendMessage as any).mockResolvedValue(true);
        (PipelineService.createTask as any).mockResolvedValue({});
    });

    it("rejects executing a run belonging to another team", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(baseRun({ teamId: "other-team" }));

        await expect(SequenceService.executeRun({ runId: "run-1", teamId: "team-1" }))
            .rejects.toThrow(/does not belong to team/);

        expect(mockDb.sequenceStepRun.update).not.toHaveBeenCalled();
    });

    it("allows executing a run belonging to the caller's own team", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(baseRun({ teamId: "team-1" }));
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});

        const result = await SequenceService.executeRun({ runId: "run-1", teamId: "team-1" });

        expect(result.status).not.toBe(undefined);
    });

    it("allows executing without a teamId (internal processDue caller, already claim-gated)", async () => {
        mockDb.sequenceStepRun.findUnique.mockResolvedValue(baseRun({ teamId: "team-1" }));
        mockDb.sequenceStep.findFirst.mockResolvedValue(null);
        mockDb.sequenceStepRun.update.mockResolvedValue({});
        mockDb.sequenceEnrollment.update.mockResolvedValue({});

        const result = await SequenceService.executeRun({ runId: "run-1" });

        expect(result.status).not.toBe(undefined);
    });
});
