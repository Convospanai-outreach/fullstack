import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// The campaign's landing page already says what the problem is and what is promised. When the
// email campaign is linked to that landing campaign, the cold email is shown the same brief so the
// email and the page it leads to make the same promise. Off unless COPY_BRIEF=on.
//
// Unlike the playbook and gold examples this is campaign fact, not teaching material, so it sits on
// the composer input: the critic and the grounding guard then treat it as supplied context too.

const MAX_CHARS = 400;

export function briefEnabled(): boolean {
    return process.env["COPY_BRIEF"] === "on";
}

const clip = (text: string) => {
    const t = text.trim();
    return t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}…` : t;
};

export function renderCampaignBrief(parts: { challenge?: string | null; solution?: string | null; benefit?: string | null }): string {
    const lines = [
        parts.challenge?.trim() ? `Problem: ${clip(parts.challenge)}` : "",
        parts.solution?.trim() ? `Approach: ${clip(parts.solution)}` : "",
        parts.benefit?.trim() ? `Promise: ${clip(parts.benefit)}` : "",
    ].filter(Boolean);
    return lines.join("\n");
}

// Empty when the flag is off, there is no linked landing campaign, or the lookup fails.
export async function loadCampaignBrief(campaignId: string | undefined, teamId: string): Promise<string> {
    if (!briefEnabled() || !campaignId || !teamId) return "";
    try {
        const landing = await prisma.landingCampaign.findFirst({
            where: { linkedCampaignId: campaignId, teamId },
            orderBy: { updatedAt: "desc" },
            select: { challenge: true, solution: true, benefit: true },
        });
        return landing ? renderCampaignBrief(landing) : "";
    } catch (error: any) {
        logger.warn("[copy brief] Lookup unavailable, continuing without it", { error: error?.message ?? String(error) });
        return "";
    }
}
