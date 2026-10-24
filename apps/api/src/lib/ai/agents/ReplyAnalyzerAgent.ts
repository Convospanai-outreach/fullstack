import { aiService } from "@/lib/aiService";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { classifyReply, type ReplyClassification } from "@/lib/ai/jev";

// SOP: the action each classification calls for. A rep still makes every change.
const SUGGESTED_ACTIONS = {
    INTERESTED: "SCHEDULE_MEETING",
    QUESTION: "SENT_REPLY",
    NOT_INTERESTED: "PAUSE_CAMPAIGN",
    OOO: "SNOOZE",
    DNC: "BLACKLIST"
} as const;

// Only these get a drafted response; the rest need no reply from us.
const DRAFTED_CLASSIFICATIONS = new Set<ReplyClassification>(["INTERESTED", "QUESTION"]);

export interface ReplyAnalysisResult {
    classification: ReplyClassification;
    confidence: number;
    reasoning: string;
    suggestedAction: 'PAUSE_CAMPAIGN' | 'SENT_REPLY' | 'SCHEDULE_MEETING' | 'SNOOZE' | 'BLACKLIST';
    draftResponse?: string;
}

export class ReplyAnalyzerAgent {
    
    /**
     * Analyzes an incoming email reply using the SOP Reply Decision Tree.
     * Classify-and-store only: the result is a suggestion shown in the Action Inbox. It never
     * changes the lead (no DNC/blacklist, no stage change) and writes no learned memory.
     * Jev classifies the reply; aiService drafts a response (metered against the lead's team)
     * only for INTERESTED and QUESTION. Throws when the lead is not in `teamId` or either call
     * fails, so no ReplyTracker row is stored for a failed analysis.
     *
     * @param subject Email subject
     * @param body Email body content
     * @param leadId ID of the lead who replied
     * @param senderEmail The email address of the sender
     * @param messageId The inbound Message this reply was stored as (kept in ReplyTracker.emailId)
     * @param teamId Team the lead must belong to
     */
    static async analyzeAndTrack(
        subject: string,
        body: string,
        leadId: string,
        senderEmail: string,
        messageId: string,
        teamId: string
    ): Promise<ReplyAnalysisResult> {

        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { teamId: true, enrichedData: true } });
        if (!lead) throw new Error("Lead not found for this team");

        logger.info(`[ReplyAnalyzer] Analyzing reply from Lead ${leadId}`);

        // 1. Mask PII in incoming content (Sovereign Firewall)
        logger.info(`[ReplyAnalyzer] Masking ingress PII for Lead ${leadId}...`);
        const { safeContext: safeSubject, tokenMap: subjectMap } = await SovereignFirewall.mask(subject);
        const { safeContext: safeBody, tokenMap: bodyMap } = await SovereignFirewall.mask(body);
        
        // Merge maps for later detokenization
        const combinedTokenMap = new Map([...subjectMap, ...bodyMap]);

        let analysis: ReplyAnalysisResult;

        try {
            // 2. Classify with Jev, on the masked text
            const { classification, confidence, reasoning } = await classifyReply({ subject: safeSubject, body: safeBody }, teamId);
            analysis = { classification, confidence, reasoning, suggestedAction: SUGGESTED_ACTIONS[classification] };

            // 3. Draft a response when one is called for
            if (DRAFTED_CLASSIFICATIONS.has(classification)) {
                // Stored Crystal DISC guidance for tailoring the draft - best-effort, empty when absent.
                let personalityGuidance = "";
                try {
                    const { CrystalService } = await import("@/modules/crystal-knows/service/crystalService");
                    personalityGuidance = await CrystalService.getGuidanceForLead(lead.teamId ?? undefined, lead, "reply to this person's email");
                } catch {
                    // A reply draft without personality guidance is still better than none.
                }

                const prompt = `
            Draft a short, professional response to this email reply to our outreach.
            The sender ${classification === "INTERESTED" ? "is interested" : "asked a question"}.

            EMAIL CONTENT:
            Subject: ${safeSubject}
            Body: "${safeBody}"
${personalityGuidance ? `
            PERSONALITY GUIDANCE (DISC) for the lead - tailor the draft response to it:
            ${personalityGuidance}
` : ""}
            Respond with the draft text only.
        `;
                // Passing teamId is what meters the call (credits + usage log) against the team.
                const draft = await aiService.askAI(prompt, teamId, { taskType: "REPLY_DRAFT", disableGuardrails: true });
                if (draft.trim()) {
                    // Detokenize Draft Response asynchronously
                    analysis.draftResponse = await SovereignFirewall.unmaskAsync(
                        draft.trim(),
                        combinedTokenMap,
                        teamId,
                        `REPLY_ANALYSIS_UNMASK_${leadId}`
                    );
                }
            }

        } catch (error: any) {
            logger.error("[ReplyAnalyzer] AI Classification Failed", error);
            throw error;
        }

        // 4. Save the suggestion. Always PENDING_REVIEW: only a rep's click acts on it.
        await prisma.replyTracker.create({
            data: {
                leadId,
                emailId: messageId,
                senderEmail,
                subject,
                body,
                aiClassification: analysis.classification,
                aiConfidence: analysis.confidence,
                aiReasoning: typeof analysis.reasoning === "string" ? analysis.reasoning : null,
                status: "PENDING_REVIEW",
                replyDraft: typeof analysis.draftResponse === "string" ? analysis.draftResponse : null
            }
        });
        logger.info(`[ReplyAnalyzer] Tracked reply as ${analysis.classification}`);

        return analysis;
    }
}
