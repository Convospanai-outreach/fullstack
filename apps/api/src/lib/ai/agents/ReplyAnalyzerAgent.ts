import { aiService } from "@/lib/aiService";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

export interface ReplyAnalysisResult {
    classification: 'INTERESTED' | 'NOT_INTERESTED' | 'OOO' | 'QUESTION' | 'DNC';
    confidence: number;
    reasoning: string;
    suggestedAction: 'PAUSE_CAMPAIGN' | 'SENT_REPLY' | 'SCHEDULE_MEETING' | 'SNOOZE' | 'BLACKLIST';
    draftResponse?: string;
}

export class ReplyAnalyzerAgent {
    
    /**
     * Analyzes an incoming email reply using the SOP Reply Decision Tree.
     * 
     * @param subject Email subject
     * @param body Email body content
     * @param leadId ID of the lead who replied
     * @param senderEmail The email address of the sender
     */
    static async analyzeAndTrack(
        subject: string, 
        body: string, 
        leadId: string,
        senderEmail: string,
        emailId?: string
    ): Promise<ReplyAnalysisResult> {
        
        logger.info(`[ReplyAnalyzer] Analyzing reply from Lead ${leadId}`);

        // 1. Mask PII in incoming content (Sovereign Firewall)
        logger.info(`[ReplyAnalyzer] Masking ingress PII for Lead ${leadId}...`);
        const { safeContext: safeSubject, tokenMap: subjectMap } = await SovereignFirewall.mask(subject);
        const { safeContext: safeBody, tokenMap: bodyMap } = await SovereignFirewall.mask(body);
        
        // Merge maps for later detokenization
        const combinedTokenMap = new Map([...subjectMap, ...bodyMap]);

        // 2. Construct the analysis prompt based on SOP
        const prompt = `
            You are the "Reply Analyzer Agent" for an email outreach system.
            Analyze the following email reply based on the standard operating procedure (SOP).

            EMAIL CONTENT:
            Subject: ${safeSubject}
            Body: "${safeBody}"

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
            const resultText = await aiService.askAI(prompt, undefined, { taskType: "CLASSIFICATION", expectsJson: true, disableGuardrails: true });
            
            // Clean Markdown code blocks if present
            const cleanedJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
            analysis = JSON.parse(cleanedJson);

            // 3. Detokenize Draft Response asynchronously
            if (analysis.draftResponse) {
                analysis.draftResponse = await SovereignFirewall.unmaskAsync(
                    analysis.draftResponse, 
                    combinedTokenMap, 
                    "SYSTEM", // Team ID fallback
                    `REPLY_ANALYSIS_UNMASK_${leadId}`
                );
            }

        } catch (error: any) {
            logger.error("[ReplyAnalyzer] AI Classification Failed", error);
            // Fallback safe defaults
            analysis = {
                classification: 'QUESTION', // Assume question to force human review
                confidence: 0.0,
                reasoning: "AI Parsing Failed. Manual Review Required.",
                suggestedAction: 'PAUSE_CAMPAIGN'
            };
        }

        // 3. Determine Final Status (HITL Logic)
        let status = "PENDING_REVIEW";
        
        // Auto-handle DNC and High-Confidence OOO
        if (analysis.classification === 'DNC' && analysis.confidence > 0.9) {
            status = "AUTO_HANDLED";
            await this.handleDNC(leadId);
        } else if (analysis.classification === 'OOO' && analysis.confidence > 0.9) {
            status = "AUTO_HANDLED";
             // In real impl, we would schedule a snooze here
        }

        // 4. Save to Database (ReplyTracker)
        try {
            await prisma.replyTracker.create({
                data: {
                    leadId,
                    emailId: emailId ?? null,
                    senderEmail,
                    subject,
                    body,
                    aiClassification: analysis.classification,
                    aiConfidence: analysis.confidence,
                    aiReasoning: analysis.reasoning ?? null,
                    status: status,
                    actionTaken: status === 'AUTO_HANDLED' ? analysis.suggestedAction : null,
                    replyDraft: analysis.draftResponse ?? null
                }
            });
            logger.info(`[ReplyAnalyzer] Tracked reply as ${analysis.classification} (Status: ${status})`);

            // 5. SELF-LEARNING: Automatically consolidate success patterns
            if (analysis.classification === 'INTERESTED' && analysis.confidence > 0.8) {
                // Fetch teamId via lead relationship
                const leadWithTeam = await prisma.lead.findUnique({
                    where: { id: leadId },
                    select: { teamId: true, company: true, jobTitle: true }
                });

                if (leadWithTeam && leadWithTeam.teamId) {
                    const lesson = `Pattern: Success with ${leadWithTeam.company} (${leadWithTeam.jobTitle}). 
                    Reasoning: ${analysis.reasoning}. 
                    Outcome: Lead expressed interest. 
                    Lesson learned: Continue using this pitch angle.`;

                    await prisma.agentMemory.create({
                        data: {
                            teamId: leadWithTeam.teamId,
                            key: "outcome_success",
                            value: lesson,
                            confidence: 1.0
                        }
                    });
                    logger.info(`[Self-Learning] Success memory synthesized for team ${leadWithTeam.teamId}`);
                }
            }
        } catch (dbError) {
             logger.error("[ReplyAnalyzer] Failed to save/learn to DB", dbError);
        }

        return analysis;
    }

    private static async handleDNC(leadId: string) {
        // Implement Blacklist Logic
        await prisma.lead.update({
            where: { id: leadId },
            data: { status: 'DNC', tags: { push: 'BLACKLISTED' } }
        });
        logger.warn(`[ReplyAnalyzer] Lead ${leadId} automatically marked as DNC.`);
    }
}
