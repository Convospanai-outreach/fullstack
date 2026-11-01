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

export function isLandingImageStorageConfigured(): boolean {
    return getConfig() !== null;
}

// Stores bytes at `objectPath` (bucket-relative, e.g. `<teamId>/<uuid>.png`) in the
// public landing-images bucket and returns the public URL. Callers encode any
// untrusted path segment themselves. Throws when storage is not configured or the
// upload is rejected.
export async function putLandingImage(objectPath: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const config = getConfig();
    if (!config) {
        throw new Error("Supabase Storage is not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)");
    }
    const storagePath = `${BUCKET}/${objectPath}`;

    const res = await fetch(`${config.origin}/storage/v1/object/${storagePath}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.serviceRoleKey}`,
            apikey: config.serviceRoleKey,
            "Content-Type": contentType,
            "x-upsert": "true",
        },
        body: new Uint8Array(bytes),
    });

    if (!res.ok) {
        throw new Error(`Image upload failed: ${res.status} ${await res.text()}`);
    }

    return `${config.origin}/storage/v1/object/public/${storagePath}`;
}

class ImageGenerationService {
    async generateSectionImage(prompt: string, teamId: string, key: string): Promise<ImageGenerationResult> {
        if (!getConfig()) {
            return { status: "skipped", details: "Supabase Storage is not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)" };
        }

        try {
            const imageBuffer = await aiService.generateImage(prompt, teamId);
            const url = await putLandingImage(encodeURIComponent(key), new Uint8Array(imageBuffer), "image/png");
            return { status: "generated", url };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[ImageGenerationService] generateSectionImage error for key ${key}:`, { error: message });
            return { status: "error", details: message };
        }
    }
}

export const imageGenerationService = new ImageGenerationService();
