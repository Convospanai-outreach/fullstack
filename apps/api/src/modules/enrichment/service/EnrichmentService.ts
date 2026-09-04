
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

export class EnrichmentService {
    static async enrichLead(leadId: string, teamId: string) {
        // leadId is caller-supplied - verify it belongs to the caller's own
        // team before enqueueing, matching the pattern already applied to
        // the other two lead_enrichment entry points (enrichment/lead and
        // learning/enrich-lead routes, OPEN-157), so a caller can't trigger
        // (and have another team billed for) enrichment of a lead they
        // don't own.
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, teamId },
            select: { teamId: true }
        });

        if (!lead) {
            return null;
        }

        const job = await JobQueue.enqueue("lead_enrichment", {
            leadId,
            teamId
        });

        return { success: true, jobId: job.id };
    }
}
