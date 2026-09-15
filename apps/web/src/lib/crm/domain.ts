// Mirrors apps/api/src/lib/crm/domain.ts. apps/api and apps/web are separate
// deployables with no shared package for this logic, so this is a deliberate,
// exact-copy duplication rather than a cross-app import - keep the two files
// in sync if the normalization rules change.

const DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

function normalize(value: string): string {
    let v = value.trim().toLowerCase();
    // Strip a URL protocol/path/query if present (common in "website" CSV columns,
    // e.g. "https://acme.example/about?x=1") - domain matching only cares about the host.
    v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
    v = v.split(/[/?#]/)[0];
    v = v.replace(/^www\./, "");
    return v.replace(/\.$/, "");
}

// Throws on invalid input - for a user-submitted sending domain, where an
// invalid value is a client input error that should be rejected outright.
export function normalizeDomainStrict(value: string): string {
    const domain = normalize(value);
    if (!DOMAIN_PATTERN.test(domain)) {
        throw new Error("Enter a valid domain, such as example.com.");
    }
    return domain;
}

// Returns null instead of throwing - for extracting a domain out of messy or
// absent lead data (CSV cells, email addresses), where an invalid/missing
// value is an expected, non-exceptional case rather than a client error.
export function tryNormalizeDomain(value: string | null | undefined): string | null {
    if (!value) return null;
    const domain = normalize(value);
    return DOMAIN_PATTERN.test(domain) ? domain : null;
}

export function extractDomainFromEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const at = email.lastIndexOf("@");
    if (at === -1) return null;
    return tryNormalizeDomain(email.slice(at + 1));
}

// Legal-suffix stripping for company-name matching, shared between Netjana's
// matcher (netjanaIntelService.ts) and the org-chart account-grouping key
// (getAccountKey below) so both use the same precision improvement.
const LEGAL_SUFFIXES = [
    "incorporated", "inc", "llc", "l l c", "ltd", "limited",
    "pvt ltd", "private limited", "corporation", "corp", "company", "co",
    "gmbh", "ag", "sa", "plc", "llp",
];

export function normalizeCompanyName(raw: string | null | undefined): string {
    if (!raw) return "";
    let value = raw.toLowerCase().trim();
    // Strip a trailing legal suffix (longest match first, word-boundary aware)
    // before collapsing to alphanumerics only.
    const sorted = [...LEGAL_SUFFIXES].sort((a, b) => b.length - a.length);
    for (const suffix of sorted) {
        const pattern = new RegExp(`[\\s.,]+${suffix.replace(/\s+/g, "[\\s.]*")}\\.?$`, "i");
        if (pattern.test(value)) {
            value = value.replace(pattern, "");
            break;
        }
    }
    return value.replace(/[^a-z0-9]/g, "");
}

// Account-grouping key for on-demand org charts: no Company entity exists in
// the schema, so leads are grouped by domain when available, falling back to
// suffix-stripped normalized company name.
export function getAccountKey(lead: { domain?: string | null; company?: string | null }): string | null {
    if (lead.domain) return `domain:${lead.domain}`;
    const normalized = normalizeCompanyName(lead.company);
    return normalized ? `company:${normalized}` : null;
}
