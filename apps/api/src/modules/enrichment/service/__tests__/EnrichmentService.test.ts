import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findFirst: vi.fn(),
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
        it("enqueues a lead_enrichment job when the lead belongs to the caller's team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ teamId: "team-1" });
            (JobQueue.enqueue as any).mockResolvedValue({ id: "job-1" });

            const result = await EnrichmentService.enrichLead("lead-1", "team-1");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({
                where: { id: "lead-1", teamId: "team-1" },
                select: { teamId: true },
            });
            expect(JobQueue.enqueue).toHaveBeenCalledWith("lead_enrichment", {
                leadId: "lead-1",
                teamId: "team-1",
            });
            expect(result).toEqual({ success: true, jobId: "job-1" });
        });

        it("refuses to enrich a lead that doesn't belong to the caller's team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            const result = await EnrichmentService.enrichLead("lead-from-team-b", "team-a");

            expect(JobQueue.enqueue).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });
});
