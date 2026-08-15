import type { CaseStudyInput, CaseStudyResult, RAGEnhancedCopy } from "../types";

export class CaseStudyService {
    async ingestCaseStudy(data: any, teamId: string) {
        const { prisma } = await import("@/lib/db");
        const payload = data as CaseStudyInput;
        const created = await prisma.caseStudy.create({
            data: {
                title: payload.title,
                industry: payload.industry,
                summary: payload.summary,
                content: payload.content,
                metrics: payload.metrics ?? {},
                teamId
            }
        });
        return created;
    }

    async retrieveRelevantCaseStudies(query: string, teamId: string, limit: number = 3) {
        const { prisma } = await import("@/lib/db");
        const items = await prisma.caseStudy.findMany({
            where: {
                teamId,
                OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { summary: { contains: query, mode: "insensitive" } },
                    { content: { contains: query, mode: "insensitive" } },
                    { industry: { contains: query, mode: "insensitive" } }
                ]
            },
            take: limit,
            orderBy: { updatedAt: "desc" }
        });
        return items.map((item): CaseStudyResult => ({
            id: item.id,
            title: item.title,
            industry: item.industry,
            summary: item.summary,
            metrics: (item.metrics as any) || {},
            similarity: 0.7
        }));
    }

    async generateRAGEnhancedCopy(leadContext: string, purpose: string, teamId: string) {
        const examples = await this.retrieveRelevantCaseStudies(leadContext, teamId, 3) as CaseStudyResult[];
        const copy: RAGEnhancedCopy = {
            copy: `Purpose: ${purpose}\n\nContext: ${leadContext}\n\nRelevant proof points:\n${examples.map((e: CaseStudyResult) => `- ${e.title}: ${e.summary}`).join("\n")}`,
            usedCaseStudies: examples,
            confidence: examples.length ? 0.7 : 0.4,
            groundedClaims: examples.map((e: CaseStudyResult) => e.summary).slice(0, 3)
        };
        return copy;
    }

    async deleteCaseStudy(caseStudyId: string, teamId: string) {
        const { prisma } = await import("@/lib/db");
        const deleted = await prisma.caseStudy.deleteMany({
            where: { id: caseStudyId, teamId }
        });
        return deleted.count > 0;
    }

    async listCaseStudies(teamId: string) {
        const { prisma } = await import("@/lib/db");
        const items = await prisma.caseStudy.findMany({
            where: { teamId },
            orderBy: { updatedAt: "desc" }
        });
        return items;
    }
}

export const caseStudyService = new CaseStudyService();
