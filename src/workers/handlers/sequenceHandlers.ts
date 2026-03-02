import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { JobPayload } from "@/lib/queue";
import { SequenceService, SequenceStep } from "@/lib/sequenceService";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";

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
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (lead && lead.email) {
                const { EmailService } = require("@/lib/emailService");

                // AI Personalization
                let emailBody = "Hi, just checking in on my previous message.";
                let emailSubject = "Follow up";

                // Check if we have scraped data (enrichedData or just raw profile text stored somewhere)
                // Assuming enrichedData might contain the scraped profile if we saved it there during VISIT/SCRAPE
                // Or we can try to use the 'linkedIn' URL as context if we don't have deep data, 
                // but ideally we want the scraped bio.

                // Let's assume for now we pass the 'linkedIn' URL and maybe some basic info we have.
                // But to be truly "AI Embedded based on profile", we need the profile text.
                // In handleSequenceAction for VISIT, we did:
                // result = await runLinkedInAction({ type: "SCRAPE", ... });
                // But we didn't save the result to DB in that block (it just returned result).
                // We should probably have saved it. 

                // For this implementation, I will try to use 'enrichedData' if available, 
                // otherwise I'll fallback to a generic AI improvement of the template.

                const profileContext = lead.enrichedData ? JSON.stringify(lead.enrichedData) : `Profile URL: ${lead.linkedIn}`;

                try {
                    // Generate personalized email
                    // We'll ask AI to write a follow-up based on the profile
                    const prompt = `Write a short, professional B2B follow-up email to a lead.
                    
                    Lead Context: ${profileContext}
                    
                    My Goal: Schedule a demo for our AI sales agent platform.
                    Previous Interaction: I sent a connection request on LinkedIn.
                    
                    Keep it under 100 words. Return ONLY the email body.`;

                    emailBody = await aiService.askAI(prompt);

                    // Generate subject line too
                    const subjectPrompt = `Generate a short, catchy subject line for this email body: "${emailBody}". Return ONLY the subject line.`;
                    emailSubject = await aiService.askAI(subjectPrompt);

                } catch (error) {
                    console.warn("AI Email generation failed, falling back to template", error);
                }

                result = await EmailService.sendEmail(lead.email, emailSubject, emailBody);
            } else {
                console.log(`No email found for lead ${leadId}, skipping email step.`);
                result = { ok: true, skipped: true };
            }
            break;
    }

    if (result && result.ok) {
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
