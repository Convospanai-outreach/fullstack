
import { prisma } from "@/lib/db";

export class EnrichmentService {
    static async enrichLead(leadId: string) {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) throw new Error("Lead not found");

        // Use AI to research the company if name exists
        let companyData: any = {};
        if (lead.company) {
            const { aiService } = await import("@/modules/ai-content/service/aiService");
            companyData = await aiService.researchCompany(lead.company);
        }

        const enrichedData = {
            industry: companyData.industry || "Unknown",
            employees: companyData.employees || "Unknown",
            revenue: companyData.revenue || "Unknown",
            summary: companyData.summary || "No summary available"
        };

        return await prisma.lead.update({
            where: { id: leadId },
            data: {
                isEnriched: true,
                enrichedData,
                status: lead.status === "NEW" ? "enriched" : lead.status
            }
        });
    }
}
