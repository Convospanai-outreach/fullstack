import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

function normalizeCompanyName(value: string | null | undefined) {
    return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

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
        const companyKey = normalizeCompanyName(lead?.company);

        const knowledgeBase = await prisma.knowledgeBase.findFirst({
            where: {
                teamId,
                name: "Netjana Intelligence",
            },
            select: { id: true },
        });

        if (!knowledgeBase) {
            return NextResponse.json({ context: "", items: [] });
        }

        const knowledgeItems = await prisma.knowledgeItem.findMany({
            where: {
                knowledgeBaseId: knowledgeBase.id,
            },
            orderBy: { createdAt: "desc" },
            take: 40,
            select: {
                id: true,
                content: true,
                metadata: true,
                createdAt: true,
            },
        });

        const prioritizedItems = knowledgeItems
            .map((item) => {
                const metadata = toRecord(item.metadata);
                const metadataCompany = normalizeCompanyName(typeof metadata.companyName === "string" ? metadata.companyName : "");
                const metadataCampaignId = typeof metadata.campaignId === "string" ? metadata.campaignId : null;
                const directCompanyMatch = Boolean(companyKey) && metadataCompany === companyKey;
                const directCampaignMatch = Boolean(effectiveCampaignId) && metadataCampaignId === effectiveCampaignId;
                const score = (directCampaignMatch ? 3 : 0) + (directCompanyMatch ? 2 : 0) + 1;

                return {
                    id: item.id,
                    content: item.content,
                    createdAt: item.createdAt,
                    score,
                    companyName: typeof metadata.companyName === "string" ? metadata.companyName : null,
                    receivedAt: typeof metadata.receivedAt === "string" ? metadata.receivedAt : item.createdAt.toISOString(),
                };
            })
            .filter((item) => item.score > 1 || !companyKey)
            .sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3);

        const context = prioritizedItems.map((item) => {
            const label = item.companyName || "Buyer signal";
            return `- ${label} (${item.receivedAt}): ${excerptContent(item.content)}`;
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
