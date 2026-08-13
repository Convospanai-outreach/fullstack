export type AgenticRagTask = {
    goal: string;
    teamId?: string | null;
    context?: unknown;
    campaignId?: string | null;
};

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    return normalized || null;
}

function getContextCampaignId(context: unknown): string | null {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
        return null;
    }

    return normalizeString((context as Record<string, unknown>).campaignId);
}

export function resolveCampaignIdForAgenticSearch(task: AgenticRagTask): string | null {
    const contextCampaignId = getContextCampaignId(task.context);
    if (contextCampaignId) {
        return contextCampaignId;
    }

    return normalizeString(task.campaignId);
}

export async function buildAgenticRagContext(
    task: AgenticRagTask,
    searchKnowledge: (campaignId: string, query: string, teamId: string) => Promise<string>
): Promise<string> {
    const teamId = normalizeString(task.teamId);
    if (!teamId) {
        return "";
    }

    const campaignId = resolveCampaignIdForAgenticSearch(task);
    if (!campaignId) {
        return "";
    }

    const query = task.goal.substring(0, 100);
    return await searchKnowledge(campaignId, query, teamId);
}
