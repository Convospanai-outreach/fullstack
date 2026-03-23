import { prisma } from "@/lib/db";

export async function buildRAGContext(company: string, query: string): Promise<string> {
    if (!company || !query) return "";
    let docs: Array<{ content: string }> = [];
    try {
        docs = await prisma.vectorDocument.findMany({
            where: {
                OR: [
                    { content: { contains: company, mode: "insensitive" } },
                    { content: { contains: query, mode: "insensitive" } }
                ]
            },
            take: 5
        });
    } catch {
        docs = [];
    }

    const snippets = docs.map(d => d.content).join("\n");
    return `Company: ${company}\nQuery: ${query}\nContext:\n${snippets}`;
}

export async function extractKeyInsights(text: string): Promise<string> {
    if (!text) return "";
    return `Key Insights: ${text.slice(0, 120)}${text.length > 120 ? "..." : ""}`;
}
