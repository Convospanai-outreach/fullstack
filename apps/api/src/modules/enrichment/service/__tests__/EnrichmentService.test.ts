import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        enqueue: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { EnrichmentService } from "../EnrichmentService";

describe("EnrichmentService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("enrichLead", () => {
        it("enqueues a lead_enrichment job scoped to the lead's team", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({ teamId: "team-1" });
            (JobQueue.enqueue as any).mockResolvedValue({ id: "job-1" });

            const result = await EnrichmentService.enrichLead("lead-1");

            expect(prisma.lead.findUnique).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                select: { teamId: true },
            });
            expect(JobQueue.enqueue).toHaveBeenCalledWith("lead_enrichment", {
                leadId: "lead-1",
                teamId: "team-1",
            });
            expect(result).toEqual({ success: true, jobId: "job-1" });
        });

        it("enqueues without a teamId when the lead has none or isn't found", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue(null);
            (JobQueue.enqueue as any).mockResolvedValue({ id: "job-2" });

            const result = await EnrichmentService.enrichLead("lead-missing");

            expect(JobQueue.enqueue).toHaveBeenCalledWith("lead_enrichment", {
                leadId: "lead-missing",
                teamId: undefined,
            });
            expect(result).toEqual({ success: true, jobId: "job-2" });
        });
    });
});
