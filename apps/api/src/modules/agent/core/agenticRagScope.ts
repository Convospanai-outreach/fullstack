export type AgenticRagTask = {
    goal: string;
    context?: unknown;
    campaignId?: string | null;
};

function getContextCampaignId(context: unknown): string | null {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
        return null;
    }

    const campaignId = (context as Record<string, unknown>).campaignId;
    if (typeof campaignId !== "string") {
        return null;
    }

    const normalized = campaignId.trim();
    return normalized || null;
}

export function resolveCampaignIdForAgenticSearch(task: AgenticRagTask): string | null {
    const contextCampaignId = getContextCampaignId(task.context);
    if (contextCampaignId) {
        return contextCampaignId;
    }

    if (typeof task.campaignId !== "string") {
        return null;
    }

    const normalized = task.campaignId.trim();
    return normalized || null;
}

export async function buildAgenticRagContext(
    task: AgenticRagTask,
    searchKnowledge: (campaignId: string, query: string) => Promise<string>
): Promise<string> {
    const campaignId = resolveCampaignIdForAgenticSearch(task);
    if (!campaignId) {
        return "";
    }

    const query = task.goal.substring(0, 100);
    return await searchKnowledge(campaignId, query);
}
