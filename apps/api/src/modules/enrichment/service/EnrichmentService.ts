
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

export class EnrichmentService {
    static async enrichLead(leadId: string) {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { teamId: true }
        });

        const job = await JobQueue.enqueue("lead_enrichment", {
            leadId,
            teamId: lead?.teamId ?? undefined
        });

        return { success: true, jobId: job.id };
    }
}
