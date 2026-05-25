import { resolveMx, resolveTxt } from "dns/promises";
import { prisma } from "@/lib/db";

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
        where: { teamId_domain: { teamId: input.teamId, domain } },
        create: {
            teamId: input.teamId,
            mailboxId: input.mailboxId || null,
            domain,
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
