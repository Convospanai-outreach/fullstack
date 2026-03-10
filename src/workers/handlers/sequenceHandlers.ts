import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { JobPayload } from "@/lib/queue";
import { SequenceService, SequenceStep } from "@/lib/sequenceService";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { composeNodeA } from "@/modules/email-campaigner/service/emailComposer";
import { EmailService } from "@/lib/emailService";

export async function handleSequenceAction(payload: JobPayload) {
    const leadId = payload['leadId'];
    const url = payload['url'];
    const action = payload['action'];

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
            const connectContext = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }).then(l => l?.enrichedData ? JSON.stringify(l.enrichedData) : `Connect with lead at ${url}`) : `Connect with lead at ${url}`;
            const message = await aiService.generateConnectionMessage(connectContext);

            // Connect with note
            result = await runLinkedInAction({
                type: "INMAIL",
                url: url,
                message: message
            });
            break;

        case "MESSAGE":
            // Follow up message - Personalized via lead context
            const followUpContext = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }).then(l => l?.enrichedData ? JSON.stringify(l.enrichedData) : `Follow up with lead at ${url}`) : `Follow up with lead at ${url}`;
            const followUpMessage = await aiService.askAI(`Write a short, professional LinkedIn follow-up message. Context: ${followUpContext}`);

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

                let emailSubject = "Checking in";
                let emailBody = "Hi, I'm following up on our LinkedIn connection request. Would love to chat about your sales motion.";

                try {
                    // 1. Prepare Node A Input
                    const nodeAInput = {
                        prospect_name: lead.fullName || "Prospect",
                        prospect_title: lead.jobTitle || "Professional",
                        prospect_company: lead.company || "Your Company",
                        pain_context: (campaign.aiConfig as any)?.painContext || "Improving sales efficiency",
                        outreach_timing: "Post-LinkedIn interaction",
                        avoid_topics: (campaign.aiConfig as any)?.avoidTopics || [],
                        hypothesis: (campaign.aiConfig as any)?.hypothesis || "Your team is looking for automation",
                        signal_type: "LinkedIn Activity",
                        extracted_signal: `Recent profile visit at ${url}`,
                        sender_name: campaign.team?.name || "ConvoSpan Team",
                        sender_email: "outbound@convospan.ai"
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

                result = await EmailService.sendEmail(lead.email, emailSubject, emailBody);
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
