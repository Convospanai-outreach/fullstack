
import { prisma } from "@/lib/db";

export class EnrichmentService {
    static async enrichLead(leadId: string) {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) throw new Error("Lead not found");

        // Simulate external API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock data enhancement
        const mockData = {
            company: lead.company || "Tech Innovators Inc.",
            jobTitle: lead.jobTitle || "Senior Developer",
            location: lead.location || "San Francisco, CA",
            linkedin: lead.linkedIn || `https://linkedin.com/in/${lead.fullName?.replace(/\s+/g, '').toLowerCase() || 'unknown'}`,
        };

        return await prisma.lead.update({
            where: { id: leadId },
            data: {
                ...mockData,
                isEnriched: true,
                enrichedData: {
                    industry: "Software",
                    employees: "50-200",
                    revenue: "$10M-$50M",
                    lastFunding: "Series B"
                },
                status: lead.status === "NEW" ? "enriched" : lead.status
            }
        });
    }
}
