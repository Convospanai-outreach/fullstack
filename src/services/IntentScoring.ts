import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export class IntentScoringService {

    /**
     * Processes the ingested webhook data.
     * Calculates Karmic Friction Score and triggers notifications.
     */
    async processWebhookData(data: any): Promise<void> {
        logger.info("[IntentScoring] Processing webhook data:", data);

        const sentiment = data.sentiment || {};
        // Pass text content if available (e.g. data.content, data.message, or data.snippet)
        const textContent = data.content || data.snippet || "No content provided";
        const frictionScore = await this.calculateKarmicFriction(sentiment, textContent);

        logger.info(`[IntentScoring] Calculated Friction Score: ${frictionScore}`);

        if (frictionScore > 80) {
            await this.triggerMasterAdminNotification(data, frictionScore);
        }

        // You might want to update the Lead or other entities here based on data
    }

    /**
     * Calculates 'Karmic Friction Score' (0-100) using Edge Node Intelligence.
     * Falls back to heuristic if offline.
     */
    private async calculateKarmicFriction(sentiment: any, textContent: string = ""): Promise<number> {
        // 1. Try Edge Node (Deep Learning)
        try {
            // Assuming EDGE_NODE_URI is available in environment or config
            const edgeUri = process.env['EDGE_NODE_URI'] || "http://localhost:8000";
            const res = await fetch(`${edgeUri}/v1/score_intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textContent || "Neutral context" })
            });

            if (res.ok) {
                const json = await res.json();
                return json.score;
            }
        } catch (e) {
            logger.warn("[IntentScoring] Edge Node offline, falling back to heuristic.");
        }

        // 2. Heuristic Fallback
        if (typeof sentiment.score === 'number') {
            if (sentiment.score < 0) {
                return Math.abs(sentiment.score) * 100;
            }
            return 0;
        }

        return 0;
    }

    private async triggerMasterAdminNotification(data: any, score: number) {
        logger.info("[IntentScoring] High Friction Detected! Triggering Master Admin Notification.");

        try {
            // Identify Super Admin / Master Admin
            // For now, we'll notify all users with 'admin' role or specific super admin
            // Optimization: Fetch specific admin user ID
            const admins = await prisma.user.findMany({
                where: { role: "admin" } // Adjust role as needed
            });

            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        type: "CRITICAL_ALERT",
                        message: `High Karmic Friction Detected (Score: ${score.toFixed(1)})`,
                        meta: {
                            source: "Scraper Webhook",
                            dataPreview: JSON.stringify(data).substring(0, 100),
                            score
                        }
                    }
                });
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
