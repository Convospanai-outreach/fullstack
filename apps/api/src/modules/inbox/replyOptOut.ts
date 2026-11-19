// A reply that asks not to be contacted again is a compliance matter, not a suggestion. When a reply is judged
// DNC with confidence (a clear phrase such as "stop emailing me" reads as DNC at 1.0 without the model, see
// lib/optOutReader), the lead is opted out: status DNC, address on the suppression list, other leads with the
// same address too, and an audit row (ComplianceGuard.enforceOptOut). A WhatsApp reply also revokes WhatsApp
// consent, as the bare STOP keyword already does.
//
// Unlike promotion, this does NOT swallow errors. A missed opt-out is the costly mistake, so a failure
// propagates, the job retries, and the retry (which re-reads the stored classification) enforces it again.
// Enforcing is idempotent. A missing or NaN confidence opts nobody out (written as "not >=").

export const OPT_OUT_MIN_CONFIDENCE = 0.7;

export async function enforceOptOutOnJudgedReply(params: {
    leadId: string;
    classification: string | null | undefined;
    confidence: number | null | undefined;
    channel: "EMAIL" | "WHATSAPP";
}): Promise<boolean> {
    if (params.classification !== "DNC" || !(Number(params.confidence) >= OPT_OUT_MIN_CONFIDENCE)) return false;

    const reason = params.channel === "WHATSAPP" ? "WhatsApp reply: the person asked not to be contacted" : "Email reply: the person asked not to be contacted";
    const { complianceGuard } = await import("@/modules/governance/ComplianceGuard");
    await complianceGuard.enforceOptOut(params.leadId, reason);
    if (params.channel === "WHATSAPP") {
        const { ConsentService } = await import("@/modules/whatsapp/ConsentService");
        await ConsentService.revokeConsent(params.leadId, undefined, reason, "WHATSAPP");
    }
    return true;
}
