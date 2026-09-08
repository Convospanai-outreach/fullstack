import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { vectorStore } from "@/modules/rag/service/vectorStore";

function toRecord(value: unknown) {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function excerptContent(value: string, maxLength = 420) {
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(req: NextRequest) {
    const { teamId } = await getCurrentContext();
    if (!teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const campaignId = typeof body?.campaignId === "string" ? body.campaignId : null;
        const leadId = typeof body?.leadId === "string" ? body.leadId : null;

        if (!campaignId && !leadId) {
            return NextResponse.json({ context: "", items: [] });
        }

        const lead = leadId
            ? await prisma.lead.findFirst({
                where: {
                    id: leadId,
                    teamId,
                },
                select: {
                    id: true,
                    company: true,
                    campaignId: true,
                },
            })
            : null;

        const effectiveCampaignId = campaignId || lead?.campaignId || null;

        // Previously restricted to only the "Netjana Intelligence" buyer-signal KB, so any
        // other knowledge base a team uploaded (pricing sheets, case studies, product docs)
        // was invisible here no matter how relevant. teamId is the session's own (never
        // derived from the lead), so this stays scoped to the caller's tenant regardless of
        // whether leadId turned out to belong to them.
        const query = [lead?.company, effectiveCampaignId].filter(Boolean).join(" ") || lead?.company || "";
        if (!query) {
            return NextResponse.json({ context: "", items: [] });
        }

        const results = await vectorStore.search(query, teamId, 3);

        const prioritizedItems = results.map((item) => {
            const metadata = toRecord(item.metadata);
            return {
                id: item.id,
                content: item.content,
                companyName: typeof metadata.companyName === "string" ? metadata.companyName : null,
                receivedAt: typeof metadata.receivedAt === "string" ? metadata.receivedAt : null,
            };
        });

        const context = prioritizedItems.map((item) => {
            const label = item.companyName || "Buyer signal";
            return `- ${label}${item.receivedAt ? ` (${item.receivedAt})` : ""}: ${excerptContent(item.content)}`;
        }).join("\n");

        return NextResponse.json({
            context,
            items: prioritizedItems.map((item) => ({
                id: item.id,
                companyName: item.companyName,
                receivedAt: item.receivedAt,
            })),
        });
    } catch (error: any) {
        console.error("[Knowledge] Failed to load campaign context", error);
        return NextResponse.json({ error: error.message || "Failed to load campaign context" }, { status: 500 });
    }
}
