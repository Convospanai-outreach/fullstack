import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enqueue, enroll } = vi.hoisted(() => ({
    db: {
        lead: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
        campaignSequence: { findMany: vi.fn() },
        leadChannelStatus: { upsert: vi.fn() },
        leadActivity: { create: vi.fn() },
        systemEvent: { create: vi.fn() },
        team: { findUnique: vi.fn() },
    },
    enqueue: vi.fn(),
    enroll: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/creator-funnel/nurtureProvider", () => ({
    CmfSequenceProvider: class { enroll = enroll; },
    nurtureCanRunSteps: (steps: { stepType: string }[]) => steps.length > 0 && steps.every((step) => step.stepType === "email"),
}));

import {
    chooseSequenceForLead,
    enrollPendingSequence,
    listSequencesForExtension,
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
