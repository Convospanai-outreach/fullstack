import { logger } from "@/lib/logger";
import { JobPayload } from "@/lib/queue";

export interface DraftGenOptions {
    provider?: "gemini" | "openai" | "anthropic";
}

async function generateEmailDraftWithAI(
    campaignName: string,
    campaignDesc: string,
    lead: any,
    options?: DraftGenOptions
): Promise<{ subject: string; body: string; providerUsed: string; estimatedCostUsd: number }> {
    const provider = options?.provider || (process.env["AI_PROVIDER"] as any) || "gemini";
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
    const leadName = lead.fullName || "there";
    const company = lead.company ? ` at ${lead.company}` : "";

    if (provider === "gemini" && apiKey) {
        try {
            let GoogleGenerativeAI: any;
            try {
                GoogleGenerativeAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
            } catch {
                GoogleGenerativeAI = undefined;
            }

            if (GoogleGenerativeAI) {
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
                    return {
                        subject: parsed.subject,
                        body: parsed.body,
                        providerUsed: "gemini-2.0-flash",
                        estimatedCostUsd: 0.0001,
                    };
                }
            }
        } catch (err: any) {
            logger.warn("[AI Draft Generation] Fallback to template due to Gemini API notice:", err?.message || err);
        }
    }

    // Fallback personalized email draft generator
    return {
        subject: `Quick question regarding ${lead.company || campaignName}`,
        body: `Hi ${leadName},\n\nI was following your work${company} and wanted to reach out regarding ${campaignName}.\n\n${campaignDesc || "We help teams scale their outreach workflows with AI automation."}\n\nWould you be open to a quick 10-minute chat this week?\n\nBest regards,`,
        providerUsed: "template-fallback",
        estimatedCostUsd: 0,
    };
}

export async function handleCampaignExecution(payload: JobPayload) {
    const { campaignId, teamId } = payload;

    if (!campaignId) {
        throw new Error("campaign_execution: campaignId is required");
    }

    const { prisma } = await import("@/lib/db");

    // 1. Load campaign
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { leadList: true },
    });

    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    // 2. Update status to active
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "active" },
    });

    // 3. Get leads attached to campaign or team
    let leads = campaign.leadList;
    if (!leads || leads.length === 0) {
        leads = await prisma.lead.findMany({
            where: { campaignId },
            take: 50,
        });
    }
    const activeTeamId = teamId || campaign.teamId;
    if ((!leads || leads.length === 0) && activeTeamId) {
        leads = await prisma.lead.findMany({
            where: { teamId: activeTeamId },
            take: 10,
        });
    }

    // 4. Generate AI drafts directly for each lead with Circuit Breaker
    let enqueued = 0;
    let consecutiveFailures = 0;
    let totalCostEst = 0;

    for (const lead of leads) {
        try {
            // Idempotency guard: skip leads that already have a draft for this campaign
            // (prevents duplicate drafts on job retry)
            const existingDraft = await prisma.email.findFirst({
                where: { leadId: lead.id, campaignId: campaign.id, status: "draft" },
                select: { id: true },
            });
            if (existingDraft) {
                logger.info(`[campaign_execution] Skipping lead ${lead.id}: draft already exists (idempotency guard)`);
                enqueued++; // Count as already handled
                continue;
            }

            const { subject, body, providerUsed, estimatedCostUsd } = await generateEmailDraftWithAI(
                campaign.name,
                campaign.description || "",
                lead
            );

            // Atomic: email + lead status + approval request all succeed or all roll back
            await prisma.$transaction(async (tx) => {
                const createdEmail = await tx.email.create({
                    data: {
                        leadId: lead.id,
                        campaignId: campaign.id,
                        subject,
                        body,
                        status: "draft",
                    },
                });

                await tx.lead.update({
                    where: { id: lead.id },
                    data: { status: "DRAFT_READY", campaignId: campaign.id },
                });

                if (activeTeamId) {
                    let requesterId = campaign.ownerId || payload.userId;
                    if (!requesterId) {
                        const teamUser = await tx.user.findFirst({
                            where: { memberships: { some: { teamId: activeTeamId } } },
                        });
                        requesterId = teamUser?.id;
                    }

                    if (!requesterId) {
                        throw new Error(`[campaign_execution] Approval gate failed: No valid requester user found for team ${activeTeamId}`);
                    }

                    await tx.approvalRequest.create({
                        data: {
                            teamId: activeTeamId,
                            requesterId,
                            actionType: "SEND_EMAIL_DRAFT",
                            entityType: "Email",
                            entityId: createdEmail.id,
                            status: "PENDING",
                            reason: `AI draft generated for ${lead.email || lead.fullName || "lead"} in campaign ${campaign.name}`,
                            payload: {
                                emailId: createdEmail.id,
                                leadId: lead.id,
                                campaignId: campaign.id,
                                subject,
                                body,
                            },
                        },
                    });
                }
            });

            enqueued++;
            consecutiveFailures = 0;
            totalCostEst += estimatedCostUsd;

            logger.info("[AI Draft Telemetry] Cost & approval gate logged:", {
                campaignId: campaign.id,
                leadId: lead.id,
                provider: providerUsed,
                costEst: estimatedCostUsd,
            });
        } catch (err: any) {
            consecutiveFailures++;
            logger.error(`[campaign_execution] Failed draft for lead ${lead.id}:`, err?.message || err);

            // Circuit Breaker: Halt after 3 consecutive generation failures
            if (consecutiveFailures >= 3) {
                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: { status: "review_required" },
                });
                logger.error(`[Circuit Breaker] Tripped after ${consecutiveFailures} consecutive failures on campaign ${campaignId}`);
                throw new Error(`Draft generation halted after 3 consecutive failures. Campaign ${campaignId} flagged for review.`);
            }
        }
    }

    // 5. Update campaign completedCount based on actual completed leads
    if (enqueued > 0) {
        const realCompletedCount = await prisma.lead.count({
            where: {
                campaignId,
                status: { in: ["DRAFT_READY", "SENT", "COMPLETED", "REPLIED"] },
            },
        });

        const targetLeadCount = await prisma.lead.count({
            where: { campaignId },
        });

        const cappedCompletedCount = targetLeadCount > 0
            ? Math.min(realCompletedCount, targetLeadCount)
            : realCompletedCount;

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { completedCount: cappedCompletedCount },
        });
    }

    logger.info("[campaign_execution] Generated drafts directly for campaign", { campaignId, enqueued, totalCostEst });
    return { success: true, enqueued, totalCostEst, status: "active" };
}
