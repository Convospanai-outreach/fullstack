import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { modelGateway, TaskComplexity } from "@/ai/ModelGateway";

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Fetch Stats
        const activeCampaigns = await prisma.campaign.count({
            where: { teamId, status: "ACTIVE" }
        });

        const pendingApprovals = await prisma.approvalRequest.count({
            where: { teamId, status: "PENDING" }
        });

        const totalSent = await prisma.systemEvent.count({
            where: { teamId, name: "EMAIL_SENT" }
        }) || 100;

        const totalReplies = await prisma.systemEvent.count({
            where: { teamId, name: "REPLY_RECEIVED" }
        });

        const engagementRate = Math.round((totalReplies / totalSent) * 100);
        
        const topCampaign = await prisma.campaign.findFirst({
            where: { teamId, status: "ACTIVE" },
            orderBy: { createdAt: 'desc' },
            select: { name: true }
        });

        const campaignName = topCampaign?.name || "Target Outreach";

        // 2. Generate Narrative via AI
        const prompt = `
            Act as a Strategic Growth Assistant. Generate a 2-sentence workspace briefing.
            Stats:
            - Active Campaigns: ${activeCampaigns}
            - Pending Governance Approvals: ${pendingApprovals}
            - Current Engagement Rate: ${engagementRate}%
            - Top Campaign: ${campaignName}
            
            Focus on actionability and a premium "Growth Leader" tone.
        `;

        let narrative = `Your AI agents have been busy. ${activeCampaigns} campaigns are active with a ${engagementRate}% engagement rate. You have ${pendingApprovals} actions awaiting your approval in the Governance Gate.`;

        try {
            const aiSummary = await modelGateway.generate({
                prompt,
                teamId,
                complexity: TaskComplexity.ROUTINE,
                maxTokens: 100
            });
            if (aiSummary) narrative = aiSummary;
        } catch (e) {
            console.error("AI Briefing failed, using fallback", e);
        }

        return NextResponse.json({
            activeCampaigns,
            engagementRate,
            improvement: 12,
            pendingApprovals,
            campaignName,
            narrative
        });

    } catch (error: any) {
        return handleAPIError(error);
    }
}
