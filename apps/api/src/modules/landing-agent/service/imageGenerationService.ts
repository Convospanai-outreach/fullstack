import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";

// Uploads AI-generated section images to the public `landing-images` Supabase
// Storage bucket (the same storage apps/web uses for logos and post media), over
// the Storage REST API so this app needs no Supabase client. Mirrors
// cloudflarePagesService.ts's no-op/error-return shape: never throws into callers,
// just returns a status.

export interface ImageGenerationResult {
    status: "generated" | "skipped" | "error";
    url?: string;
    details?: string;
}

const BUCKET = "landing-images";

function getConfig() {
    const url = process.env["SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceRoleKey) return null;
    return { origin: new URL(url).origin, serviceRoleKey };
}

class ImageGenerationService {
    async generateSectionImage(prompt: string, teamId: string, key: string): Promise<ImageGenerationResult> {
        const config = getConfig();
        if (!config) {
            return { status: "skipped", details: "Supabase Storage is not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)" };
        }

        try {
            const imageBuffer = await aiService.generateImage(prompt, teamId);
            const objectPath = `${BUCKET}/${encodeURIComponent(key)}`;

            const res = await fetch(`${config.origin}/storage/v1/object/${objectPath}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.serviceRoleKey}`,
                    apikey: config.serviceRoleKey,
                    "Content-Type": "image/png",
                    "x-upsert": "true",
                },
                body: new Uint8Array(imageBuffer),
            });

            if (!res.ok) {
                throw new Error(`Image upload failed: ${res.status} ${await res.text()}`);
            }

            return { status: "generated", url: `${config.origin}/storage/v1/object/public/${objectPath}` };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[ImageGenerationService] generateSectionImage error for key ${key}:`, { error: message });
            return { status: "error", details: message };
        }
    }
}

export const imageGenerationService = new ImageGenerationService();
