import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enqueue, enroll, completeLinkedInRunsForLead, findDueLinkedInStep, completeManualRun } = vi.hoisted(() => ({
    db: {
        lead: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
        campaignSequence: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
        leadChannelStatus: { upsert: vi.fn() },
        leadActivity: { create: vi.fn() },
        systemEvent: { create: vi.fn() },
        team: { findUnique: vi.fn() },
    },
    enqueue: vi.fn(),
    enroll: vi.fn(),
    completeLinkedInRunsForLead: vi.fn(),
    findDueLinkedInStep: vi.fn(),
    completeManualRun: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/creator-funnel/nurtureProvider", () => ({
    CmfSequenceProvider: class { enroll = enroll; },
    nurtureCanRunSteps: (steps: { stepType: string }[]) => steps.length > 0 && steps.every((step) => step.stepType === "email"),
}));

vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({
    SequenceService: { completeLinkedInRunsForLead, findDueLinkedInStep, completeManualRun },
}));

import {
    chooseSequenceForLead,
    completeLinkedInStep,
    enrollPendingSequence,
    enrollWaitingSequences,
    listSequencesForExtension,
    markLinkedInOutreachDone,
    syncLinkedInExtensionCapture,
} from "../extensionLeadCaptureService";

const capture = (payload: Record<string, unknown> = {}) =>
    syncLinkedInExtensionCapture({
        teamId: "team-a",
        userId: "user-1",
        payload: { name: "Jane Doe", linkedinUrl: "http://in.linkedin.com/in/Jane-Doe?trk=x", ...payload },
    });

describe("syncLinkedInExtensionCapture", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.lead.findFirst.mockResolvedValue(null);
        db.lead.findMany.mockResolvedValue([]);
        db.lead.create.mockImplementation(async ({ data }: any) => ({ id: "lead-new", isEnriched: false, ...data }));
        db.lead.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, isEnriched: false, ...data }));
        db.systemEvent.create.mockResolvedValue({});
        db.team.findUnique.mockResolvedValue({ autoEnrichCapturedLeads: true });
        enqueue.mockResolvedValue({ id: "job-1" });
    });

    it("finds the lead a CSV import created through the stored URL form, and merges into it", async () => {
        db.lead.findFirst.mockResolvedValueOnce({ id: "lead-csv", linkedIn: "https://www.linkedin.com/in/jane-doe/", email: "jane@acme.example", emails: [], channelStatuses: [], isEnriched: false });

        const result = await capture();

        expect(db.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-a", linkedIn: "https://www.linkedin.com/in/jane-doe/" },
        }));
        expect(db.lead.create).not.toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({ leadId: "lead-csv", matchedExisting: true }));
    });

    it("queues enrichment once per lead when the team has it on", async () => {
        const result = await capture();

        expect(db.lead.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ linkedIn: "https://www.linkedin.com/in/jane-doe/" }),
        }));
        expect(enqueue).toHaveBeenCalledWith(
            "lead_enrichment",
            { leadId: "lead-new", teamId: "team-a" },
            { teamId: "team-a", idempotencyKey: "extension_enrich_lead-new" }
        );
        expect(result.enrichmentQueued).toBe(true);
    });

    it("doesn't queue enrichment when the team turned it off", async () => {
        db.team.findUnique.mockResolvedValue({ autoEnrichCapturedLeads: false });

        const result = await capture();

        expect(enqueue).not.toHaveBeenCalled();
        expect(result.enrichmentQueued).toBe(false);
    });

    it("doesn't queue enrichment for a lead that's already enriched", async () => {
        db.lead.findFirst.mockResolvedValueOnce({ id: "lead-csv", linkedIn: "https://www.linkedin.com/in/jane-doe/", emails: [], channelStatuses: [] });
        db.lead.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, isEnriched: true, ...data }));

        const result = await capture();

        expect(enqueue).not.toHaveBeenCalled();
        expect(result.enrichmentQueued).toBe(false);
    });

    it("still saves the capture when queueing fails", async () => {
        enqueue.mockRejectedValue(new Error("queue down"));

        const result = await capture();

        expect(result).toEqual(expect.objectContaining({ success: true, leadId: "lead-new", enrichmentQueued: false }));
    });
});

describe("sequences from the extension", () => {
    const welcome = { id: "seq-1", name: "Welcome", steps: [{ stepType: "email", whatsappTemplateName: null }] };
    const linkedinOnly = { id: "seq-2", name: "LinkedIn touches", steps: [{ stepType: "linkedin_message", whatsappTemplateName: null }] };

    beforeEach(() => {
        vi.clearAllMocks();
        db.campaignSequence.findMany.mockResolvedValue([welcome, linkedinOnly]);
        db.lead.update.mockResolvedValue({});
        db.leadActivity.create.mockResolvedValue({});
        enroll.mockResolvedValue(undefined);
    });

    it("lists only switched-on sequences the engine can run", async () => {
        expect(await listSequencesForExtension("team-a")).toEqual([{ id: "seq-1", name: "Welcome", steps: 1 }]);
        expect(db.campaignSequence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "ACTIVE" } }));
    });

    it("enrols a lead that has an email straight away", async () => {
        db.lead.findFirst.mockResolvedValue({ id: "lead-1", email: "jane@acme.example", enrichedData: { pendingSequence: { sequenceId: "old" } } });

        const result = await chooseSequenceForLead({ teamId: "team-a", userId: "user-1", leadId: "lead-1", sequenceId: "seq-1" });

        expect(enroll).toHaveBeenCalledWith({ id: "lead-1", teamId: "team-a" }, "seq-1");
        expect(db.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { enrichedData: {} } });
        expect(result.status).toBe("ENROLLED");
    });

    it("keeps the choice for a lead with no email yet, without enrolling", async () => {
        db.lead.findFirst.mockResolvedValue({ id: "lead-1", email: null, enrichedData: { extensionCapture: {} } });

        const result = await chooseSequenceForLead({ teamId: "team-a", userId: "user-1", leadId: "lead-1", sequenceId: "seq-1" });

        expect(enroll).not.toHaveBeenCalled();
        expect(db.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { enrichedData: { extensionCapture: {}, pendingSequence: expect.objectContaining({ sequenceId: "seq-1", chosenBy: "user-1" }) } },
        });
        expect(result.status).toBe("WAITING_FOR_EMAIL");
    });

    it("refuses a lead from another team and a sequence that isn't available", async () => {
        db.lead.findFirst.mockResolvedValueOnce(null);
        await expect(chooseSequenceForLead({ teamId: "team-a", userId: "user-1", leadId: "lead-x", sequenceId: "seq-1" })).rejects.toThrow("Lead not found");
        expect(db.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-x", teamId: "team-a" } }));

        db.lead.findFirst.mockResolvedValueOnce({ id: "lead-1", email: "jane@acme.example", enrichedData: null });
        await expect(chooseSequenceForLead({ teamId: "team-a", userId: "user-1", leadId: "lead-1", sequenceId: "seq-2" })).rejects.toThrow("Sequence not available");
        expect(enroll).not.toHaveBeenCalled();
    });

    it("enrols a waiting lead once it has an email, and clears the choice", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "jane@acme.example", enrichedData: { pendingSequence: { sequenceId: "seq-1", chosenBy: "user-1" } } });

        expect(await enrollPendingSequence("lead-1")).toBe(true);
        expect(enroll).toHaveBeenCalledWith({ id: "lead-1", teamId: "team-a" }, "seq-1");
        expect(db.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { enrichedData: {} } });
    });

    it("clears the choice without enrolling when the sequence was switched off meanwhile", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "jane@acme.example", enrichedData: { pendingSequence: { sequenceId: "seq-gone", chosenBy: "user-1" } } });

        expect(await enrollPendingSequence("lead-1")).toBe(false);
        expect(enroll).not.toHaveBeenCalled();
        expect(db.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { enrichedData: {} } });
    });

    it("does nothing for a lead with no choice waiting", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "jane@acme.example", enrichedData: {} });

        expect(await enrollPendingSequence("lead-1")).toBe(false);
        expect(db.lead.update).not.toHaveBeenCalled();
    });
});

describe("sweep for leads waiting on an email", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.campaignSequence.findMany.mockResolvedValue([{ id: "seq-1", name: "Welcome", steps: [{ stepType: "email", whatsappTemplateName: null }] }]);
        db.lead.update.mockResolvedValue({});
        db.leadActivity.create.mockResolvedValue({});
        enroll.mockResolvedValue(undefined);
    });

    it("enrols each waiting lead that now has an email, and keeps going past one that fails", async () => {
        db.$queryRaw.mockResolvedValue([{ id: "lead-1" }, { id: "lead-2" }, { id: "lead-3" }]);
        db.lead.findUnique
            .mockResolvedValueOnce({ id: "lead-1", teamId: "team-a", email: "a@acme.example", enrichedData: { pendingSequence: { sequenceId: "seq-1", chosenBy: "user-1" } } })
            .mockRejectedValueOnce(new Error("db hiccup"))
            .mockResolvedValueOnce({ id: "lead-3", teamId: "team-a", email: "c@acme.example", enrichedData: { pendingSequence: { sequenceId: "seq-1", chosenBy: "user-1" } } });

        expect(await enrollWaitingSequences()).toBe(2);
        expect(enroll).toHaveBeenCalledTimes(2);
    });
});

describe("marking LinkedIn outreach done", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", status: "LINKEDIN_CAPTURED", channelStatuses: [], emails: [] });
        db.lead.update.mockResolvedValue({ id: "lead-1", status: "CONTACTED" });
        completeLinkedInRunsForLead.mockResolvedValue({ resumed: 1 });
    });

    it("moves on the sequences that were waiting on a LinkedIn step for that lead", async () => {
        const result = await markLinkedInOutreachDone({ teamId: "team-a", userId: "user-1", leadId: "lead-1" });

        expect(completeLinkedInRunsForLead).toHaveBeenCalledWith("team-a", "lead-1", expect.any(Date));
        expect(result).toEqual(expect.objectContaining({ success: true, status: "CONTACTED", sequencesResumed: 1 }));
    });

    it("does not look for sequences when the lead is not in the team", async () => {
        db.lead.findFirst.mockResolvedValue(null);

        await expect(markLinkedInOutreachDone({ teamId: "team-a", userId: "user-1", leadId: "lead-x" })).rejects.toThrow("Lead not found");

        expect(completeLinkedInRunsForLead).not.toHaveBeenCalled();
    });
});

describe("marking one LinkedIn sequence step done", () => {
    const step = { teamId: "team-a", userId: "user-1", runId: "run-1" };

    beforeEach(() => {
        vi.clearAllMocks();
        db.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a", status: "LINKEDIN_CAPTURED", channelStatuses: [], emails: [] });
        db.lead.update.mockResolvedValue({ id: "lead-1", status: "CONTACTED" });
        findDueLinkedInStep.mockResolvedValue({ leadId: "lead-1", action: "Send invitation", reachesPerson: true });
        completeManualRun.mockResolvedValue({ resumed: true });
    });

    it("records the outreach on the lead, then moves that one sequence on", async () => {
        const result = await completeLinkedInStep(step);

        expect(db.leadChannelStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { leadId_channel: { leadId: "lead-1", channel: "LINKEDIN" } },
            update: expect.objectContaining({ status: "CONTACTED" }),
        }));
        expect(db.leadActivity.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", notes: "Sequence step: Send invitation", createdBy: "user-1" }),
        });
        expect(completeManualRun).toHaveBeenCalledWith("team-a", "run-1", expect.any(Date));
        expect(db.lead.update.mock.invocationCallOrder[0]).toBeLessThan(completeManualRun.mock.invocationCallOrder[0]);
        expect(completeLinkedInRunsForLead).not.toHaveBeenCalled();
        expect(result).toEqual({ success: true, action: "Send invitation", sequenceResumed: true });
    });

    it("does not call a profile visit outreach", async () => {
        findDueLinkedInStep.mockResolvedValue({ leadId: "lead-1", action: "Visit profile", reachesPerson: false });

        await completeLinkedInStep(step);

        expect(db.lead.update).not.toHaveBeenCalled();
        expect(db.leadActivity.create).not.toHaveBeenCalled();
        expect(completeManualRun).toHaveBeenCalledWith("team-a", "run-1", expect.any(Date));
    });

    it("refuses a step that is not waiting", async () => {
        findDueLinkedInStep.mockResolvedValue(null);

        await expect(completeLinkedInStep(step)).rejects.toThrow("Step not found");

        expect(completeManualRun).not.toHaveBeenCalled();
    });

    it("leaves the step waiting when the lead could not be updated", async () => {
        db.lead.update.mockRejectedValue(new Error("db down"));

        await expect(completeLinkedInStep(step)).rejects.toThrow("db down");

        expect(completeManualRun).not.toHaveBeenCalled();
    });
});
