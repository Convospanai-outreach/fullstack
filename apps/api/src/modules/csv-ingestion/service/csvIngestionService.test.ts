import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
        lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
        leadDataSource: { create: vi.fn() },
    },
}));

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

        const csv = "email,fullName,website\nlead@example.com,Test Lead,https://acme.example\n";
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
