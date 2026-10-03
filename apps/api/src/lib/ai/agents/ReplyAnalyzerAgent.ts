import { aiService } from "@/lib/aiService";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

const CLASSIFICATIONS = ['INTERESTED', 'NOT_INTERESTED', 'OOO', 'QUESTION', 'DNC'] as const;

export interface ReplyAnalysisResult {
    classification: (typeof CLASSIFICATIONS)[number];
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
     * Metered against the lead's team through aiService. Throws when the lead is not in
     * `teamId` or the AI call fails, so no ReplyTracker row is stored for a failed analysis.
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

        // Stored Crystal DISC guidance for tailoring the draft - best-effort, empty when absent.
        let personalityGuidance = "";
        try {
            const { CrystalService } = await import("@/modules/crystal-knows/service/crystalService");
            personalityGuidance = await CrystalService.getGuidanceForLead(lead.teamId ?? undefined, lead, "reply to this person's email");
        } catch {
            // A reply draft without personality guidance is still better than none.
        }

        // 2. Construct the analysis prompt based on SOP
        const prompt = `
            You are the "Reply Analyzer Agent" for an email outreach system.
            Analyze the following email reply based on the standard operating procedure (SOP).

            EMAIL CONTENT:
            Subject: ${safeSubject}
            Body: "${safeBody}"
${personalityGuidance ? `
            PERSONALITY GUIDANCE (DISC) for the lead - tailor the draft response to it:
            ${personalityGuidance}
` : ""}
            CLASSIFICATION CATEGORIES:
            1. INTERESTED: "Let's talk", "Demo", "Pricing?", "Calendar", "Send more info".
            2. QUESTION: "How does it work?", "Integration?", "Is this compliant?", "Case studies?".
            3. NOT_INTERESTED: "No thanks", "We have a solution", "Too expensive".
            4. OOO (Out of Office): "Automatic reply", "Vacation", "ooo".
            5. DNC (Do Not Contact): "Unsubscribe", "Remove me", "Spam", "Stop emailing".

            YOUR TASK:
            1. Classify the email into one of the above categories.
            2. Assign a confidence score (0.0 to 1.0).
            3. Explain your reasoning briefly.
            4. Suggest the MANDATORY ACTION based on SOP:
               - INTERESTED -> SCHEDULE_MEETING
               - QUESTION -> SENT_REPLY
               - NOT_INTERESTED -> PAUSE_CAMPAIGN
               - OOO -> SNOOZE
               - DNC -> BLACKLIST
            5. Draft a short, professional response if applicable (leave empty for DNC/OOO).

            OUTPUT FORMAT (JSON ONLY):
            {
                "classification": "CATEGORY",
                "confidence": 0.95,
                "reasoning": "...",
                "suggestedAction": "ACTION",
                "draftResponse": "..."
            }
        `;

        let analysis: ReplyAnalysisResult;

        try {
            // 2. Call AI Service
            // Using a high-level "askAI" call. Ideally, we'd use a more structured output mode if available.
            // Passing teamId is what meters the call (credits + usage log) against the team.
            const resultText = await aiService.askAI(prompt, teamId, { taskType: "CLASSIFICATION", expectsJson: true, disableGuardrails: true });

            // Clean Markdown code blocks if present
            const cleanedJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
            analysis = JSON.parse(cleanedJson);
            if (!CLASSIFICATIONS.includes(analysis.classification) || typeof analysis.confidence !== "number") {
                throw new Error("AI returned an unusable classification");
            }

            // 3. Detokenize Draft Response asynchronously
            if (analysis.draftResponse) {
                analysis.draftResponse = await SovereignFirewall.unmaskAsync(
                    analysis.draftResponse, 
                    combinedTokenMap, 
                    teamId,
                    `REPLY_ANALYSIS_UNMASK_${leadId}`
                );
            }

        } catch (error: any) {
            logger.error("[ReplyAnalyzer] AI Classification Failed", error);
            throw error;
        }

        // 3. Save the suggestion. Always PENDING_REVIEW: only a rep's click acts on it.
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
