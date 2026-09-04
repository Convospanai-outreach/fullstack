import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/modules/scraper-bridge", () => ({
    scraperService: { scrape: vi.fn() },
}));

vi.mock("@/modules/hunter-email-finder", () => ({
    hunterService: { findAndStoreEmail: vi.fn() },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: { enqueue: vi.fn() },
}));

vi.mock("@/lib/credits", () => ({
    deductCredits: vi.fn(),
    refundCredits: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    logWorker: vi.fn(),
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: { scoreAndPersist: vi.fn() },
}));

vi.mock("@/modules/webhooks/service/webhookService", () => ({
    webhookService: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from "@/lib/db";
import { deductCredits, refundCredits } from "@/lib/credits";
import { handleLeadEnrichment } from "../enrichment-worker";

describe("enrichment-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (deductCredits as any).mockResolvedValue(true);
    });

    it("throws when leadId is missing", async () => {
        await expect(handleLeadEnrichment({ teamId: "team-a" } as any)).rejects.toThrow(
            "Lead identifier (leadId) is missing in payload"
        );
    });

    it("throws when the lead can't be found", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue(null);

        await expect(
            handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Lead lead-1 not found");
        expect(refundCredits).toHaveBeenCalledWith("team-a", 1, expect.stringContaining("lead-1"));
    });

    it("refuses to enrich a lead whose stored teamId doesn't match the enqueuing payload's teamId, and refunds credits", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-b",
            fullName: "Jane Doe",
        });

        await expect(
            handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Lead lead-1 does not belong to team team-a");
        expect(refundCredits).toHaveBeenCalledWith("team-a", 1, expect.stringContaining("lead-1"));
        expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it("enriches a lead whose teamId matches the payload's teamId", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-a",
            fullName: "Jane Doe",
            linkedIn: null,
            email: "jane@example.com",
            company: null,
        });
        (prisma.lead.update as any).mockResolvedValue({});

        const result = await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

        expect(prisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { status: "enriched", isEnriched: true },
        });
        expect(refundCredits).not.toHaveBeenCalled();
        expect(result).toMatchObject({ leadId: "lead-1" });
    });
});
