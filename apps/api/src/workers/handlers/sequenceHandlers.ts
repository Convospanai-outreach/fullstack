import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { JobPayload } from "@/lib/queue";
import { SequenceService, SequenceStep } from "@/lib/sequenceService";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { composeNodeA } from "@/modules/email-campaigner/service/emailComposer";
import { emailService } from "@/modules/email-campaigner";

function toRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
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

export async function handleSequenceAction(payload: JobPayload) {
    const leadId = payload['leadId'];
    const url = payload['url'];
    const action = payload['action'];
    const payloadTeamId = typeof payload['teamId'] === "string" ? payload['teamId'] : undefined;

    if (!leadId || !url || !action) {
        throw new Error("Missing required payload for SEQUENCE_ACTION");
    }

    console.log(`Executing sequence action ${action} for lead ${leadId}`);

    let result;

    switch (action as SequenceStep) {
        case "VISIT":
            // Just go to the URL
            result = await runLinkedInAction({
                type: "SCRAPE", // Reusing scrape to visit
                url: url
            });
            break;

        case "CONNECT":
            // Generate smart message based on lead context
            const connectLead = leadId ? await prisma.lead.findUnique({
                where: { id: leadId },
                select: { enrichedData: true, campaign: { select: { teamId: true } } }
            }) : null;
            const connectTeamId = payloadTeamId || connectLead?.campaign?.teamId;
            const connectContext = connectLead?.enrichedData ? JSON.stringify(connectLead.enrichedData) : `Connect with lead at ${url}`;
            const message = await aiService.generateConnectionMessage(connectContext, connectTeamId);

            // Connect with note
            result = await runLinkedInAction({
                type: "INMAIL",
                url: url,
                message: message
            });
            break;

        case "MESSAGE":
            // Follow up message - Personalized via lead context
            const followUpLead = leadId ? await prisma.lead.findUnique({
                where: { id: leadId },
                select: { enrichedData: true, campaign: { select: { teamId: true } } }
            }) : null;
            const followUpTeamId = payloadTeamId || followUpLead?.campaign?.teamId;
            const followUpContext = followUpLead?.enrichedData ? JSON.stringify(followUpLead.enrichedData) : `Follow up with lead at ${url}`;
            const followUpMessage = await aiService.askAI(
                `Write a short, professional LinkedIn follow-up message. Context: ${followUpContext}`,
                followUpTeamId,
                { surface: "HELPER", taskType: "LINKEDIN_FOLLOW_UP" }
            );

            result = await runLinkedInAction({
                type: "INMAIL",
                url: url,
                message: followUpMessage || "Just checking in to see if you had a chance to look at my previous message."
            });
            break;

        case "EMAIL":
            // Send email
            // We need to fetch the lead's email from DB first
            const lead = await prisma.lead.findUnique({ 
                where: { id: leadId },
                include: { campaign: { include: { team: true } } }
            });

            if (lead && lead.email && lead.campaign) {
                const campaign = lead.campaign;
                const netjanaIntel = typeof lead.enrichedData === "object" && lead.enrichedData !== null
                    ? (lead.enrichedData as any)["netjana"]
                    : null;
                const trustedNetjanaIntel = netjanaIntel
                    && netjanaIntel.signatureVerified
                    && netjanaIntel.matchConfidence !== "NONE"
                    ? netjanaIntel
                    : null;
                const automationReadyNetjanaIntel = trustedNetjanaIntel?.safeForAutomation
                    ? trustedNetjanaIntel
                    : null;

                let emailSubject = "Checking in";
                let emailBody = "Hi, I'm following up on our LinkedIn connection request. Would love to chat about your sales motion.";

                try {
                    const style = resolveEmailStyle(campaign);
                    // 1. Prepare Node A Input
                    const nodeAInput = {
                        prospect_name: lead.fullName || "Prospect",
                        prospect_title: lead.jobTitle || "Professional",
                        prospect_company: lead.company || trustedNetjanaIntel?.companyName || "Your Company",
                        pain_context: automationReadyNetjanaIntel?.whatTheyNeed || (campaign.aiConfig as any)?.painContext || "Improving sales efficiency",
                        outreach_timing: "Post-LinkedIn interaction",
                        avoid_topics: (campaign.aiConfig as any)?.avoidTopics || [],
                        hypothesis: automationReadyNetjanaIntel?.whyNow || (campaign.aiConfig as any)?.hypothesis || "Your team is looking for automation",
                        signal_type: automationReadyNetjanaIntel ? "Verified Netjana Buyer Intent" : "LinkedIn Activity",
                        extracted_signal: automationReadyNetjanaIntel?.whyNow || automationReadyNetjanaIntel?.whatTheyNeed || `Recent profile visit at ${url}`,
                        sender_name: campaign.team?.name || "CraftMyFunnel Team",
                        sender_email: "outbound@craftmyfunnel.ai",
                        tone: style.tone,
                        voice: style.voice,
                        formulation: style.formulation,
                        greeting_style: style.greeting_style,
                        sign_off: style.sign_off,
                        cta_style: style.cta_style,
                        constraints: style.constraints
                    };

                    // 2. Compose via Autonomous Knowledge Engine
                    const draft = await composeNodeA(
                        nodeAInput, 
                        campaign.teamId || "", 
                        campaign.id, 
                        lead.id
                    );

                    emailSubject = draft.subject;
                    emailBody = draft.body;

                } catch (error) {
                    console.warn("[Sequence] Autonomous generation failed, using fallback.", error);
                }

                result = await emailService.sendEmail(lead.email, emailSubject, emailBody, {
                    teamId: lead.campaign.teamId || undefined,
                    campaignId: lead.campaignId || undefined,
                    leadId: lead.id
                });
            } else {
                console.log(`No email found for lead ${leadId}, skipping email step.`);
                result = { ok: true, skipped: true };
            }
            break;
    }

    const success = result && ((result as any).ok || (result as any).success);

    if (success) {
        // Update DB status
        await prisma.lead.update({
            where: { id: leadId },
            data: { status: action } // e.g., "VISIT", "CONNECT"
        }).catch(e => console.error("Failed to update lead status", e));

        // Schedule next step
        await SequenceService.scheduleNextStep(leadId, url, action as SequenceStep);
    }

    return result;
}
