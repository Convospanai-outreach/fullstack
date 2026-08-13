import { prisma } from "@/lib/db";
import { JobPayload } from "@/lib/queue";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { composeNodeA } from "@/modules/email-campaigner/service/emailComposer";
import {
    NormalizedNetjanaSignal,
    findLeadForSignal,
    shouldQueueNetjanaFollowup,
} from "@/modules/intel/service/netjanaIntelService";

interface IntelFollowupJobPayload extends JobPayload {
    teamId?: string;
    signal?: NormalizedNetjanaSignal;
    signalId?: string;
    leadId?: string;
    campaignId?: string;
    companyName?: string;
    externalLeadId?: string;
}

function toRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function resolveEmailStyle(campaign: any) {
    const campaignConfig = toRecord(campaign?.aiConfig);
    const teamConfig = toRecord(campaign?.team?.aiConfig);

    return {
        tone: (campaignConfig.tone ?? teamConfig.tone) as string | undefined,
        voice: (campaignConfig.voice ?? teamConfig.voice) as string | undefined,
        formulation: (campaignConfig.formulation ?? teamConfig.formulation) as string | undefined,
        greeting_style: (campaignConfig.greetingStyle ?? teamConfig.greetingStyle) as string | undefined,
        sign_off: (campaignConfig.signOff ?? teamConfig.signOff) as string | undefined,
        cta_style: (campaignConfig.ctaStyle ?? teamConfig.ctaStyle) as string | undefined,
        constraints: (campaignConfig.constraints ?? teamConfig.constraints) as string | undefined,
    };
}

function buildFallbackDraft(leadName: string, signal: NormalizedNetjanaSignal, companyName: string) {
    const subject = `${companyName}: ${signal.buyingStage.toLowerCase()} intent`;
    const body = [
        `Hi ${leadName},`,
        "",
        `We noticed a verified buyer-intent signal around ${companyName}.`,
        signal.whyNow || signal.whatTheyNeed || "It looks like the account is actively exploring a solution.",
        "I thought it was worth a fast, relevant follow-up.",
        "",
        "Would it be useful if I sent over a tighter next-step suggestion?",
    ].join("\n");

    return {
        subject,
        body,
        internal_notes: "Fallback draft generated because the AI composer was unavailable or returned an error.",
    };
}

async function resolveLead(teamId: string, signal: NormalizedNetjanaSignal, payload: IntelFollowupJobPayload) {
    if (payload.leadId) {
        const directLead = await prisma.lead.findFirst({
            where: {
                id: payload.leadId,
                teamId,
            },
        });

        if (directLead) {
            return directLead;
        }
    }

    return (await findLeadForSignal(teamId, signal)).lead;
}

async function resolveCampaign(teamId: string, leadId: string | null | undefined, campaignId: string | null | undefined) {
    if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                teamId,
            },
            include: { team: true, owner: true },
        });

        if (campaign) {
            return campaign;
        }
    }

    if (!leadId) {
        return null;
    }

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            campaign: {
                include: { team: true, owner: true },
            },
        },
    });

    return lead?.campaign ?? null;
}

async function resolveRequesterId(teamId: string, ownerId?: string | null) {
    if (ownerId) {
        return ownerId;
    }

    const preferredMember = await prisma.teamMember.findFirst({
        where: {
            teamId,
            userId: { not: null },
            OR: [
                { role: "OWNER" },
                { role: "ADMIN" },
                { role: "owner" },
                { role: "admin" },
            ],
        },
        select: { userId: true },
    });

    if (preferredMember?.userId) {
        return preferredMember.userId;
    }

    const fallbackMember = await prisma.teamMember.findFirst({
        where: {
            teamId,
            userId: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
    });

    return fallbackMember?.userId ?? null;
}

function buildActivityMessage(signal: NormalizedNetjanaSignal, companyName: string) {
    return [
        `Verified Netjana signal for ${companyName} (${signal.strengthPercent}/100, ${signal.buyingStage})`,
        signal.whyNow,
        signal.whatTheyNeed,
    ]
        .filter(Boolean)
        .join(" - ");
}

export async function handleIntelFollowupRefresh(payload: IntelFollowupJobPayload) {
    const teamId = payload.teamId;
    const signal = payload.signal;

    if (!teamId) {
        throw new Error("Missing teamId for INTEL_FOLLOWUP_REFRESH");
    }

    if (!signal) {
        throw new Error("Missing signal payload for INTEL_FOLLOWUP_REFRESH");
    }

    if (!signal.safeForAutomation) {
        return {
            ok: true,
            skipped: true,
            reason: "review_required",
            signalId: signal.signalId,
        };
    }

    const lead = await resolveLead(teamId, signal, payload);
    const existingAutomation = toRecord(
        toRecord(lead?.enrichedData).netjana
    ).automation as Record<string, unknown> | undefined;

    if (
        lead &&
        existingAutomation?.signalId === signal.signalId &&
        existingAutomation?.status === "completed"
    ) {
        return {
            ok: true,
            skipped: true,
            reason: "already_completed",
            leadId: lead.id,
            campaignId: lead.campaignId || payload.campaignId || null,
        };
    }

    const campaign = await resolveCampaign(teamId, lead?.id, payload.campaignId || signal.campaignId || null);
    const companyName = lead?.company || signal.companyName;
    const isHot = shouldQueueNetjanaFollowup(signal);
    const requesterId = await resolveRequesterId(teamId, campaign?.ownerId || null);
    const campaignConfig = toRecord(campaign?.aiConfig);
    const style = resolveEmailStyle(campaign);

    let draft: { id: string; subject: string; body: string } | null = null;
    if (lead?.email && campaign) {
        const nodeAInput = {
            prospect_name: lead.fullName || "Prospect",
            prospect_title: lead.jobTitle || "Professional",
            prospect_company: companyName,
            pain_context: signal.whatTheyNeed || "Need a tighter, more relevant follow-up.",
            outreach_timing: "Triggered by verified Netjana signal",
            avoid_topics: Array.isArray(campaignConfig.avoidTopics)
                ? (campaignConfig.avoidTopics as string[])
                : [],
            hypothesis: signal.whyNow || "The account is actively evaluating the problem right now.",
            signal_type: "Verified Netjana Buyer Intent",
            extracted_signal: signal.whyNow || signal.whatTheyNeed || "High-intent buyer signal",
            sender_name: campaign.team?.name || "CraftMyFunnel Team",
            sender_email: "contact.us@craftmyfunnel.live",
            tone: style.tone,
            voice: style.voice,
            formulation: style.formulation,
            greeting_style: style.greeting_style,
            sign_off: style.sign_off,
            cta_style: style.cta_style,
            constraints: style.constraints,
        };

        let generatedDraft;
        try {
            generatedDraft = await composeNodeA(nodeAInput, teamId, campaign.id, lead.id);
        } catch (error) {
            console.warn("[Netjana Intel] Draft generation failed, using fallback draft.", error);
            generatedDraft = buildFallbackDraft(lead.fullName || "there", signal, companyName);
        }

        const draftId = `netjana_draft_${signal.signalId}`;
        const savedDraft = await prisma.email.upsert({
            where: { id: draftId },
            update: {
                leadId: lead.id,
                campaignId: campaign.id,
                subject: generatedDraft.subject,
                body: generatedDraft.body,
                status: "draft",
            },
            create: {
                id: draftId,
                leadId: lead.id,
                campaignId: campaign.id,
                subject: generatedDraft.subject,
                body: generatedDraft.body,
                status: "draft",
            },
        });

        draft = {
            id: savedDraft.id,
            subject: savedDraft.subject,
            body: savedDraft.body,
        };

        if (savedDraft && teamId) {
            let requesterId = campaign?.ownerId;
            if (!requesterId) {
                const teamUser = await prisma.user.findFirst({
                    where: { memberships: { some: { teamId } } },
                });
                requesterId = teamUser?.id;
            }
            if (requesterId) {
                await prisma.approvalRequest.upsert({
                    where: { id: `approval_draft_${savedDraft.id}` },
                    update: {
                        status: "PENDING",
                        payload: {
                            emailId: savedDraft.id,
                            leadId: lead.id,
                            campaignId: campaign?.id || null,
                            subject: savedDraft.subject,
                            body: savedDraft.body,
                        },
                    },
                    create: {
                        id: `approval_draft_${savedDraft.id}`,
                        teamId,
                        requesterId,
                        actionType: "SEND_EMAIL_DRAFT",
                        entityType: "Email",
                        entityId: savedDraft.id,
                        status: "PENDING",
                        reason: `Intel signal follow-up draft for ${lead.email || lead.fullName || "lead"}`,
                        payload: {
                            emailId: savedDraft.id,
                            leadId: lead.id,
                            campaignId: campaign?.id || null,
                            subject: savedDraft.subject,
                            body: savedDraft.body,
                        },
                    },
                }).catch((err) => {
                    console.error("[intel_followup] Failed to create ApprovalRequest for draft:", err?.message || err);
                });
            }
        }
    }

    let activityId: string | null = null;
    if (campaign) {
        const createdActivity = await prisma.activity.upsert({
            where: { id: `netjana_activity_${signal.signalId}` },
            update: {
                message: buildActivityMessage(signal, companyName),
                meta: {
                    source: "netjana-intel",
                    signalId: signal.signalId,
                    signalStrength: signal.strengthPercent,
                    buyingStage: signal.buyingStage,
                    leadId: lead?.id || null,
                    campaignId: campaign.id,
                    draftEmailId: draft?.id || null,
                },
            },
            create: {
                id: `netjana_activity_${signal.signalId}`,
                type: "NETJANA_FOLLOWUP",
                message: buildActivityMessage(signal, companyName),
                meta: {
                    source: "netjana-intel",
                    signalId: signal.signalId,
                    signalStrength: signal.strengthPercent,
                    buyingStage: signal.buyingStage,
                    leadId: lead?.id || null,
                    campaignId: campaign.id,
                    draftEmailId: draft?.id || null,
                },
                campaignId: campaign.id,
            },
        });

        activityId = createdActivity.id;
    }

    let approvalRequestId: string | null = null;
    if (requesterId && (lead || campaign)) {
        const entityType = campaign ? "Campaign" : "Lead";
        const entityId = campaign ? campaign.id : lead!.id;
        const approval = await ApprovalService.requestEntityApproval(
            entityType,
            entityId,
            teamId,
            "NETJANA_FOLLOWUP_REVIEW",
            {
                source: "netjana-intel",
                signalId: signal.signalId,
                signalStrength: signal.strengthPercent,
                buyingStage: signal.buyingStage,
                companyName,
                leadId: lead?.id || null,
                campaignId: campaign?.id || null,
                draftEmailId: draft?.id || null,
                activityId,
            },
            requesterId,
            {
                reason: `Review hot Netjana signal for ${companyName}`,
                requestId: `netjana_approval_${signal.signalId}`,
            }
        );

        approvalRequestId = approval.id;
    }

    if (lead) {
        const currentEnrichedData = toRecord(lead.enrichedData);
        const currentNetjana = toRecord(currentEnrichedData.netjana);

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                pipelineState: "HOT",
                pipelineStateChangedAt: new Date(),
                hotAt: lead.hotAt || new Date(),
                enrichedData: {
                    ...currentEnrichedData,
                    netjana: {
                        ...currentNetjana,
                        automation: {
                            signalId: signal.signalId,
                            status: "completed",
                            queued: isHot,
                            draftEmailId: draft?.id || null,
                            approvalRequestId,
                            activityId,
                            completedAt: new Date().toISOString(),
                        },
                    },
                },
            },
        });
    }

    return {
        ok: true,
        leadId: lead?.id || null,
        campaignId: campaign?.id || payload.campaignId || signal.campaignId || null,
        signalId: signal.signalId,
        draftEmailId: draft?.id || null,
        approvalRequestId,
        activityId,
        hotSignal: isHot,
    };
}
