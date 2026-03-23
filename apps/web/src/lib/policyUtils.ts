export function checkCampaignPolicy(campaign: any): string | null {
    if (!campaign) return "Campaign not found";

    // Policy: Cannot activate empty campaign
    if (!campaign.leads || campaign.leads.length === 0) {
        return "Campaign must have at least 1 lead to activate.";
    }

    // Policy: Reliability Circuit Breaker
    // If failure count is high, we might want to block resume until explicitly cleared?
    // But currently we just require manual resume.
    if (campaign.consecutiveFailures >= 5 && campaign.status === 'paused') {
        const lastFail = campaign.updatedAt ? new Date(campaign.updatedAt) : new Date();
        const diff = Date.now() - lastFail.getTime();
        // Force wait 1 minute? Just an example policy.
        if (diff < 60000) {
            return "Cooldown active due to repeated failures. Try again in 1 minute.";
        }
    }

    // Policy: Time of day (Example: No campaigns after 8 PM)
    // const hour = new Date().getHours();
    // if (hour >= 20) return "Campaigns cannot be started after 8 PM.";

    return null;
}
