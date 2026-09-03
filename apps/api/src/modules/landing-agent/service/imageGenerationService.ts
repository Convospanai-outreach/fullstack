import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";

// Uploads AI-generated section images to the same Cloudflare Worker that serves
// landing pages (workers/landing-pages), via its R2-backed internal upload route -
// this avoids needing R2 API credentials/aws-sdk in this app. Mirrors
// cloudflarePagesService.ts's no-op/error-return shape: never throws into callers,
// just returns a status.

export interface ImageGenerationResult {
    status: "generated" | "skipped" | "error";
    url?: string;
    details?: string;
}

function getConfig() {
    const origin = process.env["CLOUDFLARE_LANDING_PAGES_ORIGIN"];
    const secret = process.env["CLOUDFLARE_LANDING_PAGES_INTERNAL_SECRET"];
    if (!origin || !secret) return null;
    return { origin, secret };
}

class ImageGenerationService {
    async generateSectionImage(prompt: string, teamId: string, key: string): Promise<ImageGenerationResult> {
        const config = getConfig();
        if (!config) {
            return { status: "skipped", details: "Cloudflare is not configured (CLOUDFLARE_LANDING_PAGES_ORIGIN/INTERNAL_SECRET missing)" };
        }

        try {
            const imageBuffer = await aiService.generateImage(prompt, teamId);

            const res = await fetch(`${config.origin}/internal/assets/${encodeURIComponent(key)}`, {
                method: "POST",
                headers: {
                    "X-Internal-Secret": config.secret,
                    "Content-Type": "image/png",
                },
                body: new Uint8Array(imageBuffer),
            });

            if (!res.ok) {
                throw new Error(`Asset upload failed: ${res.status} ${await res.text()}`);
            }

            return { status: "generated", url: `${config.origin}/assets/${key}` };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[ImageGenerationService] generateSectionImage error for key ${key}:`, { error: message });
            return { status: "error", details: message };
        }
    }
}

export const imageGenerationService = new ImageGenerationService();
