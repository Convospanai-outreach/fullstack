import { resolveMx, resolveTxt } from "dns/promises";
import { prisma } from "@/lib/db";
import { lookupMx, lookupTxt } from "./dnsLookup";

type CheckStatus = "VERIFIED" | "MISSING";
const db = prisma as any;

export type DomainAuthCheckResult = {
    domain: string;
    selector: string;
    status: CheckStatus;
    checkedAt: string;
    records: {
        mx: { status: CheckStatus; host: string; values: string[] };
        spf: { status: CheckStatus; host: string; values: string[]; expected: string };
        dmarc: { status: CheckStatus; host: string; values: string[]; expectedPrefix: string };
        dkim: { status: CheckStatus; host: string; values: string[]; expectedPrefix: string };
    };
    missing: string[];
};

const GOOGLE_MX_PATTERNS = [
    "aspmx.l.google.com",
    "alt1.aspmx.l.google.com",
    "alt2.aspmx.l.google.com",
    "alt3.aspmx.l.google.com",
    "alt4.aspmx.l.google.com",
    "googlemail.com",
];

function normalizeDomain(value: string) {
    const domain = value.trim().toLowerCase().replace(/\.$/, "");
    if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) {
        throw new Error("Enter a valid domain, such as example.com.");
    }
    return domain;
}

function normalizeSelector(value?: string | null) {
    const selector = (value || "google").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(selector)) {
        throw new Error("Enter a valid DKIM selector.");
    }
    return selector;
}

async function safeResolveTxt(host: string) {
    try {
        return (await resolveTxt(host)).map((parts) => parts.join(""));
    } catch {
        return [];
    }
}

async function safeResolveMx(host: string) {
    try {
        return (await resolveMx(host)).map((record) => record.exchange.toLowerCase().replace(/\.$/, ""));
    } catch {
        return [];
    }
}

function statusFrom(found: boolean): CheckStatus {
    return found ? "VERIFIED" : "MISSING";
}

export type GenericDomainAuthResult = {
    domain: string;
    mx: boolean;
    spf: boolean;
    dmarc: boolean;
    dkim: boolean;
    // Things that pass but deserve a word (DMARC only monitoring), or fail for a reason worth naming.
    notes?: string[];
};

type SenderProfile = {
    // DKIM selectors this provider publishes under; null means unknown, so common ones are tried.
    selectors: string[] | null;
    // The include: the domain's SPF record needs for this provider; null means any SPF record counts.
    spfInclude: string | null;
    // Hosts besides the domain itself where this provider keeps its SPF record.
    spfSubdomains?: string[];
};

const COMMON_DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "s1", "s2", "mail", "smtp", "dkim"];

function profileFor(provider: string | null | undefined): SenderProfile {
    const p = (provider || "").toUpperCase();
    if (p === "GOOGLE_WORKSPACE" || p === "GMAIL_API") return { selectors: ["google"], spfInclude: "_spf.google.com" };
    if (p.startsWith("MICROSOFT")) return { selectors: ["selector1", "selector2"], spfInclude: "spf.protection.outlook.com" };
    // Resend signs as resend._domainkey and keeps its SPF record on the send subdomain.
    if (p === "RESEND") return { selectors: ["resend"], spfInclude: "amazonses.com", spfSubdomains: ["send"] };
    return { selectors: null, spfInclude: null };
}

// A DKIM TXT record counts only if it is a key record with a non-empty p= (an empty p= is a revoked key).
function isLiveDkimKey(value: string): boolean {
    if (!/(^|;)\s*(v=DKIM1|k=|p=)/i.test(value)) return false;
    const key = /(?:^|;)\s*p=([^;]*)/i.exec(value);
    return !!key && key[1].replace(/\s+/g, "").length > 0;
}

// DMARC may sit on the organisational domain rather than the sending subdomain, so look up the tree.
async function findDmarc(domain: string): Promise<string | null> {
    const labels = domain.split(".");
    for (let i = 0; i <= labels.length - 2; i++) {
        const host = `_dmarc.${labels.slice(i).join(".")}`;
        const record = (await lookupTxt(host)).find((value) => /^v=DMARC1\b/i.test(value));
        if (record) return record;
    }
    return null;
}

// Provider-aware check of a sending domain, for dashboard health and the daily watch. Throws
// DnsUnavailableError when DNS could not answer, so a timeout is never reported as a missing record.
// DKIM is checked at the provider's own selectors, or at common ones when the provider is unknown
// (an SMTP host's selector cannot be known from here). It proves a key is published, not that mail
// is being signed with it; only a real message's Authentication-Results header shows that.
export async function checkDomainDeliverabilitySignals(
    domainInput: string,
    provider?: string | null
): Promise<GenericDomainAuthResult> {
    const domain = normalizeDomain(domainInput);
    const profile = profileFor(provider);
    const notes: string[] = [];

    const spfHosts = [domain, ...(profile.spfSubdomains || []).map((sub) => `${sub}.${domain}`)];
    const selectors = profile.selectors || COMMON_DKIM_SELECTORS;

    const [mxValues, spfTxt, dmarcRecord, dkimTxt] = await Promise.all([
        lookupMx(domain),
        Promise.all(spfHosts.map((host) => lookupTxt(host))),
        findDmarc(domain),
        Promise.all(selectors.map((selector) => lookupTxt(`${selector}._domainkey.${domain}`))),
    ]);

    const mx = mxValues.length > 0;

    let spf = false;
    const missingInclude: string[] = [];
    for (const txt of spfTxt) {
        const records = txt.filter((value) => /^v=spf1\b/i.test(value));
        if (records.length > 1) {
            notes.push("More than one SPF record is published; receivers treat that as a failure. Merge them into one.");
            continue;
        }
        if (records.length === 1) {
            const covers = !profile.spfInclude || records[0].toLowerCase().includes(`include:${profile.spfInclude}`) || /redirect=/i.test(records[0]);
            if (covers) spf = true;
            else missingInclude.push(`SPF does not include ${profile.spfInclude}, so mail from your provider can fail SPF.`);
        }
    }
    // Only a problem if no host passed (Resend's root record is optional when its subdomain passes).
    if (!spf) notes.push(...missingInclude);

    const dmarc = dmarcRecord !== null;
    if (dmarcRecord && /(?:^|;)\s*p=none/i.test(dmarcRecord)) {
        notes.push("DMARC is set to p=none, which only monitors. Move to quarantine or reject once mail passes.");
    }

    const dkim = dkimTxt.some((values) => values.some(isLiveDkimKey));
    if (!dkim && dkimTxt.some((values) => values.some((value) => /(^|;)\s*p=\s*(;|$)/i.test(value)))) {
        notes.push("A DKIM key is published but its p= value is empty, which means it was revoked.");
    }

    return { domain, mx, spf, dmarc, dkim, ...(notes.length > 0 ? { notes } : {}) };
}

export async function checkGoogleWorkspaceDomainAuth(input: {
    teamId: string;
    domain: string;
    selector?: string | null;
    mailboxId?: string | null;
}): Promise<DomainAuthCheckResult> {
    const domain = normalizeDomain(input.domain);
    const selector = normalizeSelector(input.selector);
    const dmarcHost = `_dmarc.${domain}`;
    const dkimHost = `${selector}._domainkey.${domain}`;

    if (input.mailboxId) {
        const mailbox = await prisma.connectedMailbox.findFirst({
            where: { id: input.mailboxId, teamId: input.teamId },
            select: { id: true },
        });
        if (!mailbox) {
            throw new Error("Mailbox not found for this team.");
        }
    }

    const [mxValues, rootTxt, dmarcTxt, dkimTxt] = await Promise.all([
        safeResolveMx(domain),
        safeResolveTxt(domain),
        safeResolveTxt(dmarcHost),
        safeResolveTxt(dkimHost),
    ]);

    const mxVerified = mxValues.some((value) => GOOGLE_MX_PATTERNS.some((pattern) => value.includes(pattern)));
    const spfVerified = rootTxt.some((value) => /^v=spf1\b/i.test(value) && /include:_spf\.google\.com/i.test(value));
    const dmarcVerified = dmarcTxt.some((value) => /^v=DMARC1\b/i.test(value));
    const dkimVerified = dkimTxt.some((value) => /^v=DKIM1\b/i.test(value));

    const missing = [
        ...(!mxVerified ? ["Google MX"] : []),
        ...(!spfVerified ? ["Google SPF include"] : []),
        ...(!dmarcVerified ? ["DMARC TXT"] : []),
        ...(!dkimVerified ? [`DKIM TXT at ${dkimHost}`] : []),
    ];
    const status = statusFrom(missing.length === 0);
    const now = new Date();

    await db.domainAuthenticationCheck.upsert({
        // @@unique([teamId, domain, provider]) - the compound key was renamed from
        // teamId_domain when the Resend domain-verification feature added `provider`
        // to disambiguate multiple providers checking the same domain (see
        // resendDomainService.ts). This checker only ever handles Google Workspace.
        where: { teamId_domain_provider: { teamId: input.teamId, domain, provider: "GOOGLE_WORKSPACE" } },
        create: {
            teamId: input.teamId,
            mailboxId: input.mailboxId || null,
            domain,
            provider: "GOOGLE_WORKSPACE",
            status,
            mxStatus: statusFrom(mxVerified),
            spfStatus: statusFrom(spfVerified),
            dmarcStatus: statusFrom(dmarcVerified),
            dkimStatus: statusFrom(dkimVerified),
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000),
            failureReason: missing.length > 0 ? missing.join(", ") : null,
        },
        update: {
            mailboxId: input.mailboxId || null,
            status,
            mxStatus: statusFrom(mxVerified),
            spfStatus: statusFrom(spfVerified),
            dmarcStatus: statusFrom(dmarcVerified),
            dkimStatus: statusFrom(dkimVerified),
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000),
            failureReason: missing.length > 0 ? missing.join(", ") : null,
        },
    });

    return {
        domain,
        selector,
        status,
        checkedAt: now.toISOString(),
        missing,
        records: {
            mx: { status: statusFrom(mxVerified), host: domain, values: mxValues },
            spf: {
                status: statusFrom(spfVerified),
                host: domain,
                values: rootTxt.filter((value) => /^v=spf1\b/i.test(value)),
                expected: "v=spf1 include:_spf.google.com ~all",
            },
            dmarc: {
                status: statusFrom(dmarcVerified),
                host: dmarcHost,
                values: dmarcTxt.filter((value) => /^v=DMARC1\b/i.test(value)),
                expectedPrefix: "v=DMARC1",
            },
            dkim: {
                status: statusFrom(dkimVerified),
                host: dkimHost,
                values: dkimTxt.filter((value) => /^v=DKIM1\b/i.test(value)),
                expectedPrefix: "v=DKIM1",
            },
        },
    };
}
