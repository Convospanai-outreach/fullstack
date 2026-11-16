// Decides whether an approval request belongs to a campaign. Requests are stored against different
// things: the campaign itself, a lead, "leadId:channel" for a held AI message, or an email id with the
// campaign and lead in the payload. This is the one place that knows all four.

export interface ApprovalRef {
    entityType: string;
    entityId: string;
    payload: unknown;
}

export function belongsToCampaign(approval: ApprovalRef, campaignId: string, campaignLeadIds: Set<string>): boolean {
    const payload =
        approval.payload && typeof approval.payload === "object" && !Array.isArray(approval.payload)
            ? (approval.payload as Record<string, unknown>)
            : {};
    if (payload["campaignId"] === campaignId) return true;
    if (approval.entityType === "Campaign") return approval.entityId === campaignId;
    const leadId = typeof payload["leadId"] === "string" ? payload["leadId"] : approval.entityId.split(":")[0];
    return campaignLeadIds.has(leadId ?? "");
}
