// Setup wizard "Domains" step: what a failed email-domain check means in plain words, and whether the
// domains are ready. The DNS checks themselves run in the API (GET /dashboard/deliverability).

export type DomainSignals = { domain: string; mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean; active?: boolean };

export const DNS_PROPAGATION_NOTE = "DNS changes can take 24 to 48 hours to show up everywhere. A record that is missing right after you add it is normal, so be patient and test again later.";

const FIXES = {
    spf: "SPF is missing. Add a TXT record on the domain that starts with v=spf1 and includes your sending provider, so receivers know who may send for you.",
    dkim: "DKIM is missing. Add the DKIM record your mailbox provider gives you (a TXT or CNAME under a _domainkey name) so your mail is signed.",
    dmarc: "DMARC is missing. Add a TXT record at _dmarc with v=DMARC1; p=none to start, so receivers know what to do with mail that fails the checks.",
    mx: "MX is missing. The domain has no mail servers, so replies cannot reach you. Add the MX records from your mailbox provider.",
} as const;

export type DomainFix = { record: keyof typeof FIXES; text: string };

export function fixesFor(signals: DomainSignals): DomainFix[] {
    return (["spf", "dkim", "dmarc", "mx"] as const)
        .filter((record) => !signals[record])
        .map((record) => ({ record, text: FIXES[record] }));
}

// Ready means every domain we send from passes all four checks; no domain at all is not ready.
export function emailDomainsReady(domains: readonly DomainSignals[]): boolean {
    const active = domains.filter((d) => d.active !== false);
    return active.length > 0 && active.every((d) => fixesFor(d).length === 0);
}

// What the dashboard banner says about the sending domains, or null when there is nothing to say
// (no sending domain yet, or every check passes).
export function domainBannerFor(domains: readonly DomainSignals[]): { domains: string[]; text: string } | null {
    const failing = domains.filter((d) => d.active !== false && fixesFor(d).length > 0);
    if (failing.length === 0) return null;
    const names = failing.map((d) => d.domain);
    return {
        domains: names,
        text: `${names.join(", ")} ${names.length === 1 ? "is" : "are"} not fully verified yet, so mail may land in spam. ${DNS_PROPAGATION_NOTE}`,
    };
}
