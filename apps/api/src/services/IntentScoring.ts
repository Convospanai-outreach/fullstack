import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NotificationDispatcher } from "@/lib/notifications";
import { judgeFriction } from "@/lib/ai/jev";

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

        // 2. Secondary: Jev judges each kind of friction (anger, rejection, spam); the score is
        // the strongest of them, so any one that is near-certain crosses the alert threshold.
        try {
            const friction = await judgeFriction(textContent);
            const jevScore = Math.max(friction.hostile, friction.rejecting, friction.spam) * 100;
            logger.info(`[IntentScoring] Jev Score: ${jevScore.toFixed(1)}`, friction);
            return jevScore;
        } catch (jevErr) {
            logger.error("[IntentScoring] Jev fallback failed:", jevErr);
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
