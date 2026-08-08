
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

export type TriggerType = "lead.replied" | "email.opened" | "ai.suggestion";
export type ActionType = "campaign.stop" | "email.reply" | "lead.tag" | "webhook.call";

class AutomationService {
    async evaluate(teamId: string, trigger: TriggerType, context: Record<string, any>) {
        return fetch(`${API_URL}/automations/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, trigger, context })
        });
    }

    async approveLog(logId: string) {
        return fetch(`${API_URL}/automations/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logId })
        });
    }
}

export const automationService = new AutomationService();
