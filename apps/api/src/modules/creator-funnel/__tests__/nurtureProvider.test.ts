import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    team: { findUnique: vi.fn() },
    campaignSequence: { findFirst: vi.fn(), update: vi.fn() },
    connectedMailbox: { findFirst: vi.fn() },
    sequenceEnrollment: { createMany: vi.fn(), count: vi.fn() },
}));
const stopEnrollmentsForLead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({ SequenceService: { stopEnrollmentsForLead } }));
const checkTemplate = vi.hoisted(() => vi.fn());
vi.mock("@/modules/whatsapp/whatsappTemplates", () => ({ checkTemplate }));

import { CmfSequenceProvider, enrollInNurture, MauticJourneyProvider, NurtureNotConfiguredError, nurtureCanRunSteps, stopNurture, whatsappStepProblem } from "../nurtureProvider";

const sequence = (overrides: any = {}) => ({
    id: "seq-1",
    teamId: "team-a",
    campaignId: "camp-1",
    status: "DRAFT",
    senderMailboxIds: [],
    steps: [{ stepType: "EMAIL", delayDays: 1, delayHours: 2 }],
    ...overrides,
});

describe("nurture providers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.team.findUnique.mockResolvedValue({ nurtureProvider: null });
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", nurtureOwner: null });
        mockDb.lead.updateMany.mockResolvedValue({ count: 1 });
        mockDb.campaignSequence.findFirst.mockResolvedValue(sequence());
        mockDb.sequenceEnrollment.createMany.mockResolvedValue({ count: 1 });
        stopEnrollmentsForLead.mockResolvedValue({ stopped: 1 });
    });

    it("enrolls with CMf sequences by default and records CMF as the owner", async () => {
        const before = Date.now();
        expect(await enrollInNurture("team-a", "lead-1", "seq-1")).toEqual({ owner: "CMF" });

        expect(mockDb.campaignSequence.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "seq-1", teamId: "team-a" } }));
        const enrollment = mockDb.sequenceEnrollment.createMany.mock.calls[0][0];
        expect(enrollment.skipDuplicates).toBe(true);
        expect(enrollment.data[0]).toMatchObject({ teamId: "team-a", sequenceId: "seq-1", leadId: "lead-1", campaignId: "camp-1", status: "ACTIVE" });
        expect(enrollment.data[0].nextRunAt.getTime()).toBeGreaterThanOrEqual(before + 26 * 60 * 60 * 1000);
        expect(mockDb.campaignSequence.update).toHaveBeenCalledWith({ where: { id: "seq-1" }, data: { status: "ACTIVE" } });
        expect(mockDb.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "lead-1", teamId: "team-a" }, data: { nurtureOwner: "CMF" } });
    });

    it("refuses sequences it can't run", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(null);
        await expect(enrollInNurture("team-a", "lead-1", "seq-x")).rejects.toThrow("not found");

        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [{ stepType: "WHATSAPP", delayDays: 0, delayHours: 0 }] }));
        await expect(enrollInNurture("team-a", "lead-1", "seq-1")).rejects.toThrow("can't run");
        expect(mockDb.sequenceEnrollment.createMany).not.toHaveBeenCalled();
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
    });

    it("one sender: a lead owned by Mautic can't be enrolled in CMf while Mautic can't be stopped", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", nurtureOwner: "MAUTIC" });

        await expect(enrollInNurture("team-a", "lead-1", "seq-1")).rejects.toBeInstanceOf(NurtureNotConfiguredError);
        expect(mockDb.sequenceEnrollment.createMany).not.toHaveBeenCalled();
    });

    it("one sender: switching to Mautic stops CMf first, and doesn't enroll while Mautic isn't live", async () => {
        mockDb.team.findUnique.mockResolvedValue({ nurtureProvider: "MAUTIC" });
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", nurtureOwner: "CMF" });

        await expect(enrollInNurture("team-a", "lead-1", "journey-1")).rejects.toBeInstanceOf(NurtureNotConfiguredError);

        expect(stopEnrollmentsForLead).toHaveBeenCalledWith("team-a", "lead-1", "EXIT_NURTURE_SWITCHED_PROVIDER");
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-a" }, data: { nurtureOwner: null } });
        expect(mockDb.lead.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { nurtureOwner: "MAUTIC" } }));
    });

    it("stops the owning provider and clears the owner", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", nurtureOwner: "CMF" });
        expect(await stopNurture("team-a", "lead-1", "purchased")).toEqual({ stopped: true });
        expect(stopEnrollmentsForLead).toHaveBeenCalledWith("team-a", "lead-1", "EXIT_NURTURE_PURCHASED");

        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", nurtureOwner: null });
        expect(await stopNurture("team-a", "lead-1", "purchased")).toEqual({ stopped: false });
    });

    it("reports CMf status from live enrollments", async () => {
        mockDb.sequenceEnrollment.count.mockResolvedValue(1);
        expect(await new CmfSequenceProvider().status({ id: "lead-1", teamId: "team-a" })).toEqual({ active: true });
        expect(mockDb.sequenceEnrollment.count).toHaveBeenCalledWith({
            where: { teamId: "team-a", leadId: "lead-1", status: { in: ["ACTIVE", "SCHEDULING", "MANUAL_REVIEW"] } },
        });
    });

    it("the Mautic provider is a stub until Mautic is live", async () => {
        const mautic = new MauticJourneyProvider();
        const lead = { id: "lead-1", teamId: "team-a" };
        await expect(mautic.enroll(lead, "j")).rejects.toBeInstanceOf(NurtureNotConfiguredError);
        await expect(mautic.stop(lead, "x")).rejects.toBeInstanceOf(NurtureNotConfiguredError);
        await expect(mautic.status(lead)).rejects.toBeInstanceOf(NurtureNotConfiguredError);
    });
    describe("WhatsApp steps (5c-2)", () => {
        it("lets a nurture run WhatsApp steps only when they send a template", () => {
            expect(nurtureCanRunSteps([{ stepType: "EMAIL" }, { stepType: "WHATSAPP", whatsappTemplateName: "guide_ready" }])).toBe(true);
            expect(nurtureCanRunSteps([{ stepType: "EMAIL" }, { stepType: "WHATSAPP", whatsappTemplateName: null }])).toBe(false);
            expect(nurtureCanRunSteps([{ stepType: "WHATSAPP", whatsappTemplateName: "  " }])).toBe(false);
            expect(nurtureCanRunSteps([])).toBe(false);
        });

        it("before switching on, every template must be approved and sendable", async () => {
            expect(await whatsappStepProblem("team-a", [{ stepType: "EMAIL" }])).toBeNull();
            expect(checkTemplate).not.toHaveBeenCalled();
            checkTemplate.mockResolvedValue({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED", reason: "The template \"guide_ready\" isn't approved (status PENDING)." });
            expect(await whatsappStepProblem("team-a", [{ stepType: "WHATSAPP", whatsappTemplateName: "guide_ready", whatsappTemplateLanguage: "en_US" }]))
                .toBe("WhatsApp step: The template \"guide_ready\" isn't approved (status PENDING).");
            expect(checkTemplate).toHaveBeenCalledWith("team-a", "guide_ready", "en_US");
            expect(await whatsappStepProblem("team-a", [{ stepType: "WHATSAPP", whatsappTemplateName: "guide_ready", whatsappTemplateLanguage: "" }])).toMatch(/no template language/);
            checkTemplate.mockResolvedValue({ ok: true, variables: 1 });
            expect(await whatsappStepProblem("team-a", [{ stepType: "WHATSAPP", whatsappTemplateName: "guide_ready", whatsappTemplateLanguage: "en_US" }])).toBeNull();
        });
    });
});
