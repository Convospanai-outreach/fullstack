import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
        lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
        leadDataSource: { create: vi.fn() },
    },
}));

const { recordCaptureConsent } = vi.hoisted(() => ({ recordCaptureConsent: vi.fn().mockResolvedValue(true) }));
vi.mock("@/modules/governance/captureConsent", () => ({ recordCaptureConsent }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({
    ConsentService: { recordConsent: vi.fn() },
    ConsentMethod: { WEB_FORM: "WEB_FORM" },
}));

import { csvIngestionService } from "./csvIngestionService";

const CSV = "email,fullName\nlead@example.com,Test Lead\n";

describe("csvIngestionService.processCSV - cross-tenant campaign scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("drops a campaignId that doesn't belong to the importing team instead of linking leads to it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null); // campaign belongs to another team
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const result = await csvIngestionService.processCSV(CSV, "team-a", undefined, "campaign-from-team-b");

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-from-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: undefined }),
        });
        expect(result.success).toBe(true);
    });

    it("links leads to campaignId when it does belong to the importing team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.count.mockResolvedValue(1);
        mockPrisma.campaign.update.mockResolvedValue({});

        await csvIngestionService.processCSV(CSV, "team-a", undefined, "campaign-1");

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: "campaign-1" }),
        });
    });
});

describe("csvIngestionService.processCSV - domain capture", () => {
    beforeEach(() => vi.clearAllMocks());

    it("derives domain from an explicit domain/website column when present", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const csv = "email,fullName,website\nlead@example.com,Test Lead, HTTPS://WWW.Acme.Example.:443/about \n";
        await csvIngestionService.processCSV(csv, "team-a");

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ domain: "acme.example" }),
        });
    });

    it("falls back to the row's email domain when no explicit domain column exists", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        await csvIngestionService.processCSV(CSV, "team-a");

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ domain: "example.com" }),
        });
    });

    it("never derives a domain by guessing from the company-name text", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        // "lead@localhost" has no dot in its host part, so extractDomainFromEmail
        // yields null - with no explicit domain column either, company alone must
        // never produce a domain guess (the exact failure mode this field replaces).
        const csv = "email,fullName,company\nlead@localhost,Test Lead,Acme Corp\n";
        await csvIngestionService.processCSV(csv, "team-a");

        const call = mockPrisma.lead.create.mock.calls[0]?.[0];
        expect(call.data.domain).toBeFalsy();
    });
});

describe("csvIngestionService.processCSV - row count cap", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rejects a CSV with more rows than the cap instead of processing it row by row", async () => {
        const rows = Array.from({ length: 5001 }, (_, i) => `lead${i}@example.com,Lead ${i}`);
        const bigCsv = ["email,fullName", ...rows].join("\n");

        const result = await csvIngestionService.processCSV(bigCsv, "team-a");

        expect(result.success).toBe(false);
        expect(result.errors[0]?.message).toMatch(/too many rows/i);
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });
});

describe("csvIngestionService.processCSV - LinkedIn URLs", () => {
    beforeEach(() => vi.clearAllMocks());

    const LI_CSV = "email,fullName,linkedin\njane@acme.example,Jane Doe,http://www.linkedin.com/in/Jane-Doe\n";

    it("stores the profile URL in the standard form", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        await csvIngestionService.processCSV(LI_CSV, "team-a");

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ linkedIn: "https://www.linkedin.com/in/jane-doe/" }),
        });
    });

    it("gives a lead the extension captured (same profile, no email yet) its email instead of adding it twice", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce(null) // no lead with this email
            .mockResolvedValueOnce({ id: "lead-captured", email: null, domain: null });
        mockPrisma.lead.update.mockResolvedValue({});

        const result = await csvIngestionService.processCSV(LI_CSV, "team-a");

        expect(mockPrisma.lead.findFirst).toHaveBeenLastCalledWith({
            where: { teamId: "team-a", linkedIn: "https://www.linkedin.com/in/jane-doe/", email: null },
        });
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-captured" },
            data: { email: "jane@acme.example", domain: "acme.example" },
        });
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
        expect(result.created).toBe(1);
    });
});

describe("csvIngestionService.processCSV - per-row consent columns", () => {
    const CONSENT_CSV = [
        "email,fullName,consent,consent proof",
        "yes@acme.example,Yes Person,yes,Signed form 14 March",
        "no@acme.example,No Person,no,",
        "blank@acme.example,Blank Person,,",
    ].join("\n");

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockImplementation(async ({ data }: any) => ({ id: `id-${data.email}` }));
        recordCaptureConsent.mockResolvedValue(true);
    });

    it("records consent only for rows whose consent cell says yes, with the row's proof", async () => {
        const result = await csvIngestionService.processCSV(CONSENT_CSV, "team-a", undefined, undefined, { userId: "u1", hasConsent: false });

        expect(result.created).toBe(3);
        expect(recordCaptureConsent).toHaveBeenCalledTimes(1);
        expect(recordCaptureConsent).toHaveBeenCalledWith(expect.objectContaining({
            leadId: "id-yes@acme.example",
            userId: "u1",
            method: "WEB_FORM",
            channel: "EMAIL",
            proof: "Signed form 14 March",
        }));
    });

    it("falls back to naming the column as the proof when the row has no proof cell", async () => {
        await csvIngestionService.processCSV("email,consent\nyes@acme.example,true\n", "team-a");

        expect(recordCaptureConsent.mock.calls[0]![0].proof).toBe("CSV import: consent column said yes");
    });

    it("records consent for a lead that already exists when its row says yes", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-old", email: "yes@acme.example", domain: "acme.example" });

        await csvIngestionService.processCSV("email,consent\nyes@acme.example,yes\n", "team-a");

        expect(recordCaptureConsent).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-old" }));
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it("records nothing when there is no consent column", async () => {
        await csvIngestionService.processCSV("email,fullName\nyes@acme.example,A\n", "team-a");

        expect(recordCaptureConsent).not.toHaveBeenCalled();
    });

    it("keeps the importer's whole-file attestation working for new leads", async () => {
        await csvIngestionService.processCSV("email,fullName\nnew@acme.example,New Person\n", "team-a", undefined, undefined, { userId: "u1", hasConsent: true });

        expect(recordCaptureConsent).toHaveBeenCalledWith(expect.objectContaining({ leadId: "id-new@acme.example", userId: "u1", notes: "Attested by importer during CSV import" }));
    });
});
