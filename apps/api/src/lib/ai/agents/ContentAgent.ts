/**
 * Content Agent
 * Generates visual assets for outreach campaigns (Images, Slide Decks).
 * Integrates as a sub-agent for the OutreachAgent.
 */
import { logger } from "@/lib/logger";

const contentCache = new Map<string, string>();
const CONTENT_ASSET_API_URL = process.env["CONTENT_ASSET_API_URL"] || "";

type AssetResponse = { url?: string };

export class ContentAgent {
    static async generateAsset(type: "IMAGE" | "SLIDE_DECK", prompt: string): Promise<string> {
        const cacheKey = `${type}:${prompt}`;

        if (contentCache.has(cacheKey)) {
            logger.info("[ContentAgent] Cache HIT", { type, promptPreview: prompt.substring(0, 20) });
            return contentCache.get(cacheKey)!;
        }

        if (!CONTENT_ASSET_API_URL) {
            throw new Error("CONTENT_ASSET_API_URL is not configured");
        }

        const response = await fetch(`${CONTENT_ASSET_API_URL}/assets/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, prompt })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Asset generation failed: ${errorText || response.status}`);
        }

        const payload = (await response.json()) as AssetResponse;
        if (!payload.url) {
            throw new Error("Asset generation returned no URL");
        }

        contentCache.set(cacheKey, payload.url);
        return payload.url;
    }

    static async personalizeDeck(baseDeckId: string, leadContext: any): Promise<string> {
        const cacheKey = `DECK:${baseDeckId}:${leadContext.companyName}`;
        if (contentCache.has(cacheKey)) return contentCache.get(cacheKey)!;

        if (!CONTENT_ASSET_API_URL) {
            throw new Error("CONTENT_ASSET_API_URL is not configured");
        }

        const response = await fetch(`${CONTENT_ASSET_API_URL}/assets/personalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseDeckId, leadContext })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Deck personalization failed: ${errorText || response.status}`);
        }

        const payload = (await response.json()) as AssetResponse;
        if (!payload.url) {
            throw new Error("Deck personalization returned no URL");
        }

        contentCache.set(cacheKey, payload.url);
        return payload.url;
    }
}
