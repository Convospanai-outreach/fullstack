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
    records: {
        mx: { status: CheckStatus; host: string; values: string[]; type?: string };
        spf: { status: CheckStatus; host: string; values: string[]; type?: string };
        dmarc: { status: CheckStatus; host: string; values: string[]; type?: string };
        dkim: { status: CheckStatus; host: string; values: string[]; type?: string };
    };
    missing: string[];
};

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
