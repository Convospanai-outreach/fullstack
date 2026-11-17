// Lead statuses (compared lower-cased) of someone who must not be contacted again: "DNC" is what
// ComplianceGuard writes.
const OPTED_OUT_STATUSES = new Set(["dnc", "do_not_contact", "unsubscribed", "bounced"]);

export function isOptedOutStatus(status: string | null | undefined): boolean {
    return OPTED_OUT_STATUSES.has((status || "").toLowerCase());
}
