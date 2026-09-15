import { Resend } from "resend";
import { resolveTxt } from "dns/promises";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { BrandingService } from "@/modules/branding/brandingService";

type CheckStatus = "VERIFIED" | "MISSING";
const db = prisma as any;

export type ResendDomainCheckResult = {
    domain: string;
    status: CheckStatus;
    resendStatus: string;
    checkedAt: string;
    openTracking: boolean;
    clickTracking: boolean;
    records: {
        mx: { status: CheckStatus; host: string; values: string[]; type?: string };
        spf: { status: CheckStatus; host: string; values: string[]; type?: string };
        dmarc: { status: CheckStatus; host: string; values: string[]; type?: string };
        dkim: { status: CheckStatus; host: string; values: string[]; type?: string };
    };
    missing: string[];
};

export type ResendDomainSummary = {
    domain: string;
    status: CheckStatus | "UNKNOWN";
    lastCheckedAt: string | null;
    failureReason: string | null;
};

// Cheap listing straight from our own DomainAuthenticationCheck rows - no live
// Resend call, so the Settings page can render the list instantly. Tracking
// flags aren't included here (not persisted locally); a "Check now" against a
// specific domain (ensureResendDomainVerified) returns those.
export async function listResendDomains(teamId: string): Promise<ResendDomainSummary[]> {
    const rows = await db.domainAuthenticationCheck.findMany({
        where: { teamId, provider: "RESEND" },
        orderBy: { createdAt: "desc" },
        select: { domain: true, status: true, lastCheckedAt: true, failureReason: true },
    });
    return rows.map((row: any) => ({
        domain: row.domain,
        status: row.status,
        lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
        failureReason: row.failureReason,
    }));
}

function normalizeDomain(value: string) {
    const domain = value.trim().toLowerCase().replace(/\.$/, "");
    if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) {
        throw new Error("Enter a valid domain, such as example.com.");
    }
    return domain;
}

function statusFrom(found: boolean): CheckStatus {
    return found ? "VERIFIED" : "MISSING";
}

async function getVerifiedDomainRecord(teamId: string, rawDomain: string) {
    const domain = normalizeDomain(rawDomain);
    const record = await db.domainAuthenticationCheck.findUnique({
        where: { teamId_domain_provider: { teamId, domain, provider: "RESEND" } },
        select: { providerDomainId: true },
    });
    if (!record?.providerDomainId) {
        throw new Error(`No Resend domain check found for ${domain}. Add it via ensureResendDomainVerified first.`);
    }
    return { domain, providerDomainId: record.providerDomainId as string };
}

async function getResendClientForTeam(teamId: string) {
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { teamId, provider: "RESEND" },
        orderBy: { updatedAt: "desc" },
    });
    if (!mailbox) {
        throw new Error("Connect a Resend mailbox (Step 3) before checking a sending domain.");
    }

    const apiKey = await decryptCredential(mailbox.encryptedAccessToken as any);
    if (!apiKey) {
        throw new Error("Unable to read the stored Resend API key. Reconnect Resend and try again.");
    }

    return new Resend(apiKey);
}

// DMARC isn't something Resend's domain API tracks (it's a generic protocol
// recommendation, not a requirement it enforces), so it's checked directly
// via DNS the same way the Google Workspace checker does.
async function checkDmarc(domain: string) {
    const dmarcHost = `_dmarc.${domain}`;
    try {
        const records = (await resolveTxt(dmarcHost)).map((parts) => parts.join(""));
        return { host: dmarcHost, values: records.filter((value) => /^v=DMARC1\b/i.test(value)) };
    } catch {
        return { host: dmarcHost, values: [] as string[] };
    }
}

function pickRecord(records: Array<{ record: string; type: string; name: string; value: string; status: string }>, kind: string) {
    return records.find((entry) => entry.record === kind);
}

// Ensures a team's chosen sending domain is registered with Resend, returns
// the exact DNS records Resend needs (so the wizard can show them verbatim
// rather than guessing), and persists both a DomainAuthenticationCheck row
// (so a future "check domain health" feature has one place to read from
// regardless of provider) and a CustomDomain row (so the same verified
// domain is immediately available to whatever consumes CustomDomain today -
// e.g. BrandingService's white-labeled portal - and to landing pages later,
// without the user having to type the domain in twice).
export async function ensureResendDomainVerified(input: {
    teamId: string;
    domain: string;
}): Promise<ResendDomainCheckResult> {
    const domain = normalizeDomain(input.domain);
    const resend = await getResendClientForTeam(input.teamId);

    const existing = await db.domainAuthenticationCheck.findUnique({
        where: { teamId_domain_provider: { teamId: input.teamId, domain, provider: "RESEND" } },
        select: { providerDomainId: true },
    });

    let domainId = existing?.providerDomainId as string | undefined;

    if (!domainId) {
        // Claim this (teamId, domain, RESEND) row atomically via the unique
        // constraint before talking to Resend, so a second concurrent request
        // for the same brand-new domain can't also call resend.domains.create()
        // and register a duplicate domain in Resend.
        try {
            await db.domainAuthenticationCheck.create({
                data: {
                    teamId: input.teamId,
                    domain,
                    provider: "RESEND",
                    status: "MISSING",
                    lastCheckedAt: new Date(),
                    nextCheckAt: new Date(),
                },
            });
        } catch (claimError: any) {
            if (claimError?.code === "P2002") {
                throw new Error("A check for this domain is already in progress. Please try again in a few seconds.");
            }
            throw claimError;
        }

        try {
            const { data: list } = await resend.domains.list();
            const match = list?.data?.find((d) => d.name.toLowerCase() === domain);
            if (match) {
                domainId = match.id;
            } else {
                const { data: created, error: createError } = await resend.domains.create({ name: domain });
                if (createError || !created) {
                    throw new Error(createError?.message || "Resend rejected this domain. Check it's spelled correctly.");
                }
                domainId = created.id;
            }
        } catch (err) {
            // Release the claim row on failure so a retry isn't permanently
            // blocked by our own placeholder from this failed attempt.
            await db.domainAuthenticationCheck
                .delete({ where: { teamId_domain_provider: { teamId: input.teamId, domain, provider: "RESEND" } } })
                .catch(() => null);
            throw err;
        }
    }

    // Ask Resend to re-check the DNS records right now rather than relying on
    // whatever it last observed - the user is actively adding records in Cloudflare
    // in the same session and wants to see it flip to verified without a delay.
    await resend.domains.verify(domainId).catch(() => null);
    const { data: fresh, error: getError } = await resend.domains.get(domainId);
    if (getError || !fresh) {
        throw new Error(getError?.message || "Unable to fetch this domain's status from Resend.");
    }

    const spfRecord = pickRecord(fresh.records as any, "SPF");
    const dkimRecord = pickRecord(fresh.records as any, "DKIM");
    // Resend's "SPF" record entry is sometimes the required MX (for bounce/
    // feedback handling) rather than the TXT include - split by DNS type.
    const mxEntries = (fresh.records as any[]).filter((r) => r.type === "MX");

    const spfVerified = spfRecord?.status === "verified";
    const dkimVerified = dkimRecord?.status === "verified";
    const mxVerified = mxEntries.length === 0 || mxEntries.every((r) => r.status === "verified");

    const dmarc = await checkDmarc(domain);
    const dmarcVerified = dmarc.values.length > 0;

    const overallVerified = fresh.status === "verified";
    const missing = [
        ...(!spfVerified && spfRecord ? ["Resend SPF"] : []),
        ...(!dkimVerified && dkimRecord ? ["Resend DKIM"] : []),
        ...(!mxVerified ? ["Resend MX"] : []),
        ...(!dmarcVerified ? ["DMARC TXT (recommended)"] : []),
    ];

    const now = new Date();
    const status = statusFrom(overallVerified);

    await db.domainAuthenticationCheck.upsert({
        where: { teamId_domain_provider: { teamId: input.teamId, domain, provider: "RESEND" } },
        create: {
            teamId: input.teamId,
            domain,
            provider: "RESEND",
            providerDomainId: domainId,
            status,
            spfStatus: statusFrom(spfVerified),
            dkimStatus: statusFrom(dkimVerified),
            dmarcStatus: statusFrom(dmarcVerified),
            mxStatus: statusFrom(mxVerified),
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000),
            failureReason: missing.length > 0 ? missing.join(", ") : null,
        },
        update: {
            providerDomainId: domainId,
            status,
            spfStatus: statusFrom(spfVerified),
            dkimStatus: statusFrom(dkimVerified),
            dmarcStatus: statusFrom(dmarcVerified),
            mxStatus: statusFrom(mxVerified),
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000),
            failureReason: missing.length > 0 ? missing.join(", ") : null,
        },
    });

    // Best-effort: register the domain in the shared CustomDomain registry too,
    // so it's available to whatever else keys off it (branding portal today,
    // landing pages later) without re-entering it. domain has a global unique
    // constraint (one CustomDomain row can't belong to two teams), so this is
    // skipped - not overwritten - if another team already claimed it.
    const customDomain = await prisma.customDomain.findUnique({ where: { domain } }).catch(() => null);
    if (!customDomain) {
        await BrandingService.addDomain(input.teamId, domain).catch(() => null);
    }

    return {
        domain,
        status,
        resendStatus: fresh.status,
        checkedAt: now.toISOString(),
        openTracking: Boolean((fresh as any).open_tracking),
        clickTracking: Boolean((fresh as any).click_tracking),
        missing,
        records: {
            mx: {
                status: statusFrom(mxVerified),
                host: mxEntries[0]?.name || domain,
                values: mxEntries.map((r) => r.value),
                type: "MX",
            },
            spf: {
                status: statusFrom(spfVerified),
                host: spfRecord?.name || domain,
                values: spfRecord ? [spfRecord.value] : [],
                type: spfRecord?.type,
            },
            dmarc: {
                status: statusFrom(dmarcVerified),
                host: dmarc.host,
                values: dmarcVerified ? dmarc.values : ["v=DMARC1; p=none; rua=mailto:dmarc@" + domain],
                type: "TXT",
            },
            dkim: {
                status: statusFrom(dkimVerified),
                host: dkimRecord?.name || `resend._domainkey.${domain}`,
                values: dkimRecord ? [dkimRecord.value] : [],
                type: dkimRecord?.type,
            },
        },
    };
}

// Removes a team's sending domain from Resend and clears the local check row.
// Idempotent: if Resend has already forgotten this domain id (e.g. removed
// directly in the Resend dashboard), that's treated as success rather than an
// error, since the end state - "not registered with Resend" - is what we want.
export async function removeResendDomain(input: { teamId: string; domain: string }): Promise<{ domain: string; removed: true }> {
    const { domain, providerDomainId } = await getVerifiedDomainRecord(input.teamId, input.domain);
    const resend = await getResendClientForTeam(input.teamId);

    const { error } = await resend.domains.remove(providerDomainId);
    if (error && !/not.?found/i.test(error.message || "")) {
        throw new Error(error.message || "Resend rejected the request to remove this domain.");
    }

    await db.domainAuthenticationCheck
        .delete({ where: { teamId_domain_provider: { teamId: input.teamId, domain, provider: "RESEND" } } })
        .catch(() => null);

    return { domain, removed: true };
}

// Toggles Resend's own open/click tracking pixels for a team's sending domain.
// Not persisted locally - DomainAuthenticationCheck tracks DNS/verification
// state, not per-domain tracking preferences - Resend is the source of truth here.
export async function updateResendDomainTracking(input: {
    teamId: string;
    domain: string;
    openTracking?: boolean;
    clickTracking?: boolean;
}): Promise<{ domain: string; openTracking?: boolean; clickTracking?: boolean }> {
    if (input.openTracking === undefined && input.clickTracking === undefined) {
        throw new Error("Provide at least one of openTracking or clickTracking to update.");
    }
    const { domain, providerDomainId } = await getVerifiedDomainRecord(input.teamId, input.domain);
    const resend = await getResendClientForTeam(input.teamId);

    const { error } = await resend.domains.update({
        id: providerDomainId,
        ...(input.openTracking !== undefined ? { openTracking: input.openTracking } : {}),
        ...(input.clickTracking !== undefined ? { clickTracking: input.clickTracking } : {}),
    });
    if (error) {
        throw new Error(error.message || "Resend rejected the request to update this domain's tracking settings.");
    }

    return { domain, openTracking: input.openTracking, clickTracking: input.clickTracking };
}
