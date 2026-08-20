import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";
import { NotificationDispatcher } from "@/lib/notifications";

export class IntentScoringService {
    async processWebhookData(data: any): Promise<void> {
        logger.info("[IntentScoring] Processing webhook data:", data);

        const sentiment = data.sentiment || {};
        const textContent = data.content || data.snippet || data.text || "No content provided";
        const frictionScore = await this.calculateKarmicFriction(sentiment, textContent);

        logger.info(`[IntentScoring] Calculated Friction Score: ${frictionScore}`);

        if (frictionScore > 80) {
            await this.triggerMasterAdminNotification(data, frictionScore);
        }
    }

    private async calculateKarmicFriction(sentiment: any, textContent: string = ""): Promise<number> {
        // 1. Primary: Edge Node (Deep Learning)
        try {
            const edgeUri = process.env['EDGE_NODE_URI'] || "http://localhost:8000";
            const res = await fetch(`${edgeUri}/v1/score_intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textContent || "Neutral context" }),
                signal: AbortSignal.timeout(3000)
            });

            if (res.ok) {
                const json = await res.json();
                return json.score;
            }
        } catch (e) {
            logger.warn("[IntentScoring] Edge Node offline or timeout.");
        }

        // 2. Secondary: Cloud AI Fallback (LLM)
        try {
            const prompt = `Analyze the following text and provide a "Karmic Friction Score" from 0 to 100, where 100 is extremely high friction (anger, rejection, spam) and 0 is high intent/harmony.
            TEXT: "${textContent}"
            Return ONLY the number.`;
            
            const aiScoreStr = await aiService.askAI(prompt, undefined, { taskType: "ANALYSIS" });
            const aiScore = parseFloat(aiScoreStr.trim());
            if (!isNaN(aiScore)) {
                console.log(`[IntentScoring] AI Fallback Score: ${aiScore}`);
                return aiScore;
            }
        } catch (aiErr) {
            logger.error("[IntentScoring] AI Fallback failed:", aiErr);
        }

        // 3. Tertiary: Simple Heuristic Fallback
        if (typeof sentiment.score === 'number') {
            if (sentiment.score < 0) return Math.abs(sentiment.score) * 100;
        }

        return 0;
    }

    private async triggerMasterAdminNotification(data: any, score: number) {
        logger.info("[IntentScoring] High Friction Detected! Triggering Master Admin Notification.");

        try {
            // Identify Super Admin / Master Admin
            // Matches the ADMIN designation used elsewhere (ClientErrorAlertService, intel-followup-worker)
            const admins = await prisma.user.findMany({
                where: { role: "ADMIN" }
            });

            for (const admin of admins) {
                await NotificationDispatcher.send(
                    admin.id,
                    "SYSTEM",
                    "High Friction Detected",
                    `High Karmic Friction Detected (Score: ${score.toFixed(1)})`,
                    {
                        source: "Scraper Webhook",
                        dataPreview: JSON.stringify(data).substring(0, 100),
                        score
                    }
                );
            }

            // If no admins found, log warning
            if (admins.length === 0) {
                logger.warn("[IntentScoring] No admins found to notify.");
            }

        } catch (error) {
            logger.error("[IntentScoring] Failed to create notification:", error);
        }
    }
}

export const intentScoringService = new IntentScoringService();
