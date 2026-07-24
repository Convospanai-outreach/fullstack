import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JobPayload } from "@/lib/queue";

async function generateEmailDraftWithAI(campaignName: string, campaignDesc: string, lead: any): Promise<{ subject: string; body: string }> {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
    const leadName = lead.fullName || "there";
    const company = lead.company ? ` at ${lead.company}` : "";

    if (apiKey) {
        try {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: process.env["GEMINI_MODEL"] || "gemini-2.0-flash" });

            const prompt = `Write a personalized high-converting cold email for outreach campaign "${campaignName}".
Description/Goal: ${campaignDesc || "B2B partnership outreach"}
Recipient Name: ${leadName}
Recipient Company: ${lead.company || "Unknown"}

Format output strictly as JSON with keys "subject" and "body".
Do not include markdown backticks or extra commentary.`;

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
            const parsed = JSON.parse(cleanJson);
            if (parsed.subject && parsed.body) {
                return { subject: parsed.subject, body: parsed.body };
            }
        } catch (err: any) {
            logger.warn("[AI Draft Generation] Fallback to template due to Gemini API notice:", err?.message || err);
        }
    }

    // Fallback personalized email draft generator
    return {
        subject: `Quick question regarding ${lead.company || campaignName}`,
        body: `Hi ${leadName},\n\nI was following your work${company} and wanted to reach out regarding ${campaignName}.\n\n${campaignDesc || "We help teams scale their outreach workflows with AI automation."}\n\nWould you be open to a quick 10-minute chat this week?\n\nBest regards,`,
    };
}

export async function handleCampaignExecution(payload: JobPayload) {
    const { campaignId, teamId } = payload;

    if (!campaignId) {
        throw new Error("campaign_execution: campaignId is required");
    }

    // 1. Load campaign
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { leadList: true }
    });

    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    // 2. Update status to active
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "active" }
    });

    // 3. Get leads attached to campaign or team
    let leads = campaign.leadList;
    if (!leads || leads.length === 0) {
        leads = await prisma.lead.findMany({
            where: { campaignId },
            take: 50
        });
    }
    const activeTeamId = teamId || campaign.teamId;
    if ((!leads || leads.length === 0) && activeTeamId) {
        leads = await prisma.lead.findMany({
            where: { teamId: activeTeamId },
            take: 10
        });
    }

    // 4. Generate AI drafts directly for each lead
    let enqueued = 0;
    for (const lead of leads) {
        try {
            const { subject, body } = await generateEmailDraftWithAI(
                campaign.name,
                campaign.description || "",
                lead
            );

            await prisma.email.create({
                data: {
                    leadId: lead.id,
                    campaignId: campaign.id,
                    subject,
                    body,
                    status: "draft",
                }
            });

            await prisma.lead.update({
                where: { id: lead.id },
                data: { status: "DRAFT_READY", campaignId: campaign.id }
            });

            enqueued++;
        } catch (err: any) {
            logger.error(`[campaign_execution] Failed draft for lead ${lead.id}:`, err?.message || err);
        }
    }

    // 5. Update campaign completedCount
    if (enqueued > 0) {
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { completedCount: { increment: enqueued } }
        });
    }

    logger.info("[campaign_execution] Generated drafts directly for campaign", { campaignId, enqueued });
    return { success: true, enqueued, status: "active" };
}
