import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { audit } from "@/lib/governance/audit";

function rate(part: number, total: number) {
    return total > 0 ? Number((part / total).toFixed(4)) : 0;
}

function parseJsonObject(raw: string) {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
}

export async function summarizeCampaignEngagement(teamId: string, campaignId: string) {
    const [campaign, emails, activities, links, replies] = await Promise.all([
        prisma.campaign.findFirst({ where: { id: campaignId, teamId }, include: { variants: true } }),
        (prisma as any).email.findMany({ where: { campaignId }, include: { lead: true } }),
        (prisma as any).emailActivityLog.findMany({ where: { teamId, campaignId } }),
        (prisma as any).emailTrackedLink.findMany({ where: { teamId, campaignId } }),
        prisma.replyTracker.findMany({
            where: { lead: { campaignId, teamId } },
            orderBy: { receivedAt: "desc" },
            take: 15,
            select: {
                aiClassification: true,
                aiConfidence: true,
                aiReasoning: true,
                subject: true,
                body: true,
                receivedAt: true,
            },
        }),
    ]);
    if (!campaign) throw new Error("Campaign not found.");

    const sent = activities.filter((a: any) => a.eventType === "SENT").length || emails.filter((e: any) => e.status === "sent").length;
    const failed = activities.filter((a: any) => a.eventType === "FAILED").length;
    const opened = new Set(activities.filter((a: any) => a.eventType === "OPENED").map((a: any) => a.emailId).filter(Boolean)).size || emails.filter((e: any) => e.openedAt).length;
    const clicked = new Set(activities.filter((a: any) => a.eventType === "CLICKED").map((a: any) => a.emailId).filter(Boolean)).size || emails.filter((e: any) => e.clickedAt).length;
    const replied = activities.filter((a: any) => a.eventType === "REPLIED").length || replies.length;
    const unsubscribed = activities.filter((a: any) => a.eventType === "UNSUBSCRIBED").length;
    const bounced = activities.filter((a: any) => a.eventType === "BOUNCED").length;

    const linkClicks = links.map((link: any) => ({
        url: link.originalUrl,
        clickCount: link.clickCount,
        lastClickedAt: link.lastClickedAt,
    }));

    const classificationCounts = replies.reduce<Record<string, number>>((acc, reply) => {
        acc[reply.aiClassification] = (acc[reply.aiClassification] || 0) + 1;
        return acc;
    }, {});

    const sendHours = emails
        .map((email: any) => email.sentAt || email.createdAt)
        .filter(Boolean)
        .map((date: Date) => new Date(date).getUTCHours());
    const hourCounts: Record<string, number> = sendHours.reduce((acc: Record<string, number>, hour: number) => {
            acc[String(hour)] = (acc[String(hour)] || 0) + 1;
            return acc;
        }, {});
    const bestSendHour = sendHours.length
        ? Number((Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0] as [string, number])[0])
        : null;

    return {
        campaign: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            audience: campaign.audience,
            variants: campaign.variants.map((variant) => ({
                id: variant.id,
                subject: variant.subject,
                sentCount: variant.sentCount,
                openCount: variant.openCount,
                replyCount: variant.replyCount,
            })),
        },
        metrics: {
            sent,
            failed,
            opened,
            clicked,
            replied,
            unsubscribed,
            bounced,
            openRate: rate(opened, sent),
            clickRate: rate(clicked, sent),
            replyRate: rate(replied, sent),
            unsubscribeRate: rate(unsubscribed, sent),
            failureRate: rate(failed, sent + failed),
            bounceRate: rate(bounced, sent),
            bestSendHourUtc: bestSendHour,
            classificationCounts,
            linkClicks,
        },
        replySnippets: replies.map((reply) => ({
            classification: reply.aiClassification,
            confidence: reply.aiConfidence,
            reasoning: reply.aiReasoning,
            subject: reply.subject,
            snippet: reply.body.slice(0, 500),
            receivedAt: reply.receivedAt,
        })),
    };
}

export async function prepareDripDraft(input: {
    teamId: string;
    requesterId: string;
    campaignId: string;
}) {
    const summary = await summarizeCampaignEngagement(input.teamId, input.campaignId);
    const prompt = `
You are preparing the next drip email step for a human-reviewed B2B campaign.
Use only the derived engagement metrics and reply snippets below.
Do not claim guaranteed outcomes. Keep the email concise, useful, and approval-ready.

ENGAGEMENT SUMMARY:
${JSON.stringify(summary, null, 2)}

Return JSON only:
{
  "recommendedAudienceSegment": "who should receive the next drip",
  "waitTime": "recommended wait time before sending",
  "sendWindow": "recommended send window",
  "subject": "subject line",
  "body": "email body",
  "rationale": "why this next step fits the observed opens, clicks, replies, and unsubscribes"
}`;

    let draft: any;
    try {
        draft = parseJsonObject(await aiService.askAI(prompt, input.teamId, {
            taskType: "EMAIL_DRIP_DRAFT",
            surface: "EMAIL",
            expectsJson: true,
            disableGuardrails: true,
        }));
    } catch {
        draft = {
            recommendedAudienceSegment: "Leads who opened or clicked but have not replied",
            waitTime: "2 business days",
            sendWindow: summary.metrics.bestSendHourUtc === null ? "next business morning" : `${summary.metrics.bestSendHourUtc}:00 UTC`,
            subject: "Following up with a practical next step",
            body: "Hi there,\n\nI wanted to follow up with a practical next step based on what your team is likely evaluating. If useful, we can share a short workflow outline for review before anything goes live.\n\nWould it be helpful to compare that against your current lead and meeting workflow?",
            rationale: "Fallback draft created because AI JSON generation was unavailable.",
        };
    }

    const approval = await prisma.approvalRequest.create({
        data: {
            teamId: input.teamId,
            requesterId: input.requesterId,
            actionType: "DRIP_EMAIL_DRAFT",
            entityType: "Campaign",
            entityId: input.campaignId,
            reason: "AI-prepared next drip email based on Gmail engagement metrics.",
            payload: { summary, draft },
        },
    });

    await audit({
        actorId: input.requesterId,
        orgId: input.teamId,
        action: "AI_DRIP_DRAFT_CREATED",
        entity: "ApprovalRequest",
        entityId: approval.id,
        metadata: { campaignId: input.campaignId },
    });

    return { approval, summary, draft };
}
