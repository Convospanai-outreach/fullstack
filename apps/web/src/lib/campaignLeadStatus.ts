// Lead statuses that count as "processed" for a campaign's progress: a draft is ready, the email went out,
// or the lead has moved on. OUTREACH_SENT is what email-sending-worker writes once the email really goes out;
// it has to be here or a lead drops out of the count at the moment its email is sent. SENT and COMPLETED are
// older values that nothing writes now but old rows may still hold.
export const PROCESSED_LEAD_STATUSES = ["DRAFT_READY", "OUTREACH_SENT", "SENT", "COMPLETED", "REPLIED"];
