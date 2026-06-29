
import type { CaseStudyInput, CaseStudyResult, RAGEnhancedCopy } from "../types";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
const isServer = typeof window === "undefined";

export class CaseStudyService {
    async ingestCaseStudy(data: CaseStudyInput, teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const payload = data;
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
        try {
            const res = await fetch(`${API_URL}/scoring/case-study`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, teamId })
            });
            return await res.json();
        } catch (error) {
            console.error("Case study ingestion proxy failed:", error);
            throw error;
        }
    }

    async retrieveRelevantCaseStudies(query: string, teamId: string, limit: number = 3) {
        if (isServer) {
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
                metrics: (item.metrics as Record<string, number>) || {},
                similarity: 0.7
            }));
        }
        try {
            const res = await fetch(`${API_URL}/scoring/case-study/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, teamId, limit })
            });
            return await res.json();
        } catch {
            return [];
        }
    }

    async generateRAGEnhancedCopy(leadContext: string, purpose: string, teamId: string) {
        if (isServer) {
            const examples = await this.retrieveRelevantCaseStudies(leadContext, teamId, 3) as CaseStudyResult[];
            const copy: RAGEnhancedCopy = {
                copy: `Purpose: ${purpose}\n\nContext: ${leadContext}\n\nRelevant proof points:\n${examples.map((e: CaseStudyResult) => `- ${e.title}: ${e.summary}`).join("\n")}`,
                usedCaseStudies: examples,
                confidence: examples.length ? 0.7 : 0.4,
                groundedClaims: examples.map((e: CaseStudyResult) => e.summary).slice(0, 3)
            };
            return copy;
        }
        try {
            const res = await fetch(`${API_URL}/scoring/case-study/generate-copy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadContext, purpose, teamId })
            });
            return await res.json();
        } catch (error) {
            console.error("RAG copy proxy failed:", error);
            throw error;
        }
    }

    async deleteCaseStudy(caseStudyId: string, teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const deleted = await prisma.caseStudy.deleteMany({
                where: { id: caseStudyId, teamId }
            });
            return deleted.count > 0;
        }
        const res = await fetch(`${API_URL}/scoring/case-study`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseStudyId, teamId })
        });
        return res.ok;
    }

    async listCaseStudies(teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const items = await prisma.caseStudy.findMany({
                where: { teamId },
                orderBy: { updatedAt: "desc" }
            });
            return items;
        }
        try {
            const res = await fetch(`${API_URL}/scoring/case-study/list?teamId=${teamId}`);
            return await res.json();
        } catch {
            return [];
        }
    }
}

export const caseStudyService = new CaseStudyService();
