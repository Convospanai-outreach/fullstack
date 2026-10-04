import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enqueue } = vi.hoisted(() => ({
    db: {
        lead: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
        leadChannelStatus: { upsert: vi.fn() },
        leadActivity: { create: vi.fn() },
        systemEvent: { create: vi.fn() },
        team: { findUnique: vi.fn() },
    },
    enqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { syncLinkedInExtensionCapture } from "../extensionLeadCaptureService";

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
