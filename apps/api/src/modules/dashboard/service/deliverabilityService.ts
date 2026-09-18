import { prisma } from "@/lib/db";
import { checkDomainDeliverabilitySignals } from "@/modules/email-campaigner/service/domainAuthService";

const WINDOW_DAYS = 30;
const GENERIC_CHECK_PROVIDER = "GENERIC";

export type DomainHealthLabel = "Healthy" | "At Risk" | "Poor";

export type DomainHealthEntry = {
    domain: string;
    mx: boolean;
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
    // false once no currently-CONNECTED mailbox sends from this domain anymore - still
    // shown (not dropped) so a domain that went bad and got swapped out stays visible.
    active: boolean;
    score: number;
    label: DomainHealthLabel;
    lastActiveAt: string | null;
};

export type DeliverabilityStats = {
    windowDays: number;
    sentCount: number;
    bounceRate: number;
    complaintRate: number;
    openRate: number;
    unsubscribeRate: number;
    score: number;
    oneClickUnsubscribeActive: boolean;
    mailingAddressConfigured: boolean;
    domains: DomainHealthEntry[];
};

function rate(count: number, total: number): number {
    return total > 0 ? count / total : 0;
}

function domainScore(
    signals: { mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean },
    active: boolean,
    bounceRate: number,
    complaintRate: number
): number {
    let score = 100;
    if (!signals.spf) score -= 25;
    if (!signals.dkim) score -= 25;
    if (!signals.dmarc) score -= 20;
    if (!signals.mx) score -= 15;
    // Engagement penalty only applies to domains actively sending right now - a retired
    // domain's bounce/complaint rate from when it was live isn't recomputed here (the
    // Email/EmailEvent link to it is gone once its mailbox is deleted), so scoring it
    // on today's team-wide rate would misattribute another domain's problems to it.
    if (active) {
        if (bounceRate > 0.05) score -= 10;
        else if (bounceRate > 0.02) score -= 5;
        if (complaintRate > 0.001) score -= 5;
    }
    return Math.max(0, Math.min(100, score));
}

function labelFor(score: number): DomainHealthLabel {
    if (score >= 80) return "Healthy";
    if (score >= 50) return "At Risk";
    return "Poor";
}

async function checkAndRecordDomain(teamId: string, domain: string, active: boolean) {
    let signals: { mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean };
    try {
        signals = await checkDomainDeliverabilitySignals(domain);
    } catch {
        signals = { mx: false, spf: false, dkim: false, dmarc: false };
    }

    const now = new Date();
    const statusOf = (ok: boolean) => (ok ? "VERIFIED" : "MISSING");
    try {
        await (prisma as any).domainAuthenticationCheck.upsert({
            where: { teamId_domain_provider: { teamId, domain, provider: GENERIC_CHECK_PROVIDER } },
            create: {
                teamId,
                domain,
                provider: GENERIC_CHECK_PROVIDER,
                status: statusOf(signals.spf && signals.dkim && signals.dmarc),
                mxStatus: statusOf(signals.mx),
                spfStatus: statusOf(signals.spf),
                dkimStatus: statusOf(signals.dkim),
                dmarcStatus: statusOf(signals.dmarc),
                lastCheckedAt: now,
                ...(active ? { lastActiveAt: now } : {}),
            },
            update: {
                status: statusOf(signals.spf && signals.dkim && signals.dmarc),
                mxStatus: statusOf(signals.mx),
                spfStatus: statusOf(signals.spf),
                dkimStatus: statusOf(signals.dkim),
                dmarcStatus: statusOf(signals.dmarc),
                lastCheckedAt: now,
                ...(active ? { lastActiveAt: now } : {}),
            },
        });
    } catch {
        // Best-effort persistence - a write failure must not block the read.
    }

    return signals;
}

export async function getDeliverabilityStats(teamId: string): Promise<DeliverabilityStats> {
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [sentCount, bouncedCount, openedCount, unsubscribedCount, complaintCount, mailboxes, team] = await Promise.all([
        prisma.email.count({ where: { campaign: { teamId }, createdAt: { gte: windowStart } } }),
        prisma.email.count({ where: { campaign: { teamId }, createdAt: { gte: windowStart }, bouncedAt: { not: null } } }),
        prisma.email.count({ where: { campaign: { teamId }, createdAt: { gte: windowStart }, openedAt: { not: null } } }),
        prisma.email.count({ where: { campaign: { teamId }, createdAt: { gte: windowStart }, unsubscribedAt: { not: null } } }),
        prisma.emailEvent.count({ where: { teamId, createdAt: { gte: windowStart }, type: "COMPLAINED" } }),
        prisma.connectedMailbox.findMany({ where: { teamId, status: "CONNECTED" }, select: { email: true } }),
        prisma.team.findUnique({ where: { id: teamId }, select: { mailingAddress: true } }),
    ]);

    const bounceRate = rate(bouncedCount, sentCount);
    const complaintRate = rate(complaintCount, sentCount);
    const openRate = rate(openedCount, sentCount);
    const unsubscribeRate = rate(unsubscribedCount, sentCount);

    const activeDomains = Array.from(
        new Set(mailboxes.map((m) => m.email.split("@")[1]?.toLowerCase()).filter((d): d is string => Boolean(d)))
    );

    const activeEntries: DomainHealthEntry[] = await Promise.all(
        activeDomains.map(async (domain) => {
            const signals = await checkAndRecordDomain(teamId, domain, true);
            const score = domainScore(signals, true, bounceRate, complaintRate);
            return { domain, ...signals, active: true, score, label: labelFor(score), lastActiveAt: new Date().toISOString() };
        })
    );

    // Retired domains: previously checked for this team but no longer matching any
    // CONNECTED mailbox. Sourced from DomainAuthenticationCheck, which survives its
    // mailbox being deleted (mailboxId is SetNull, not the row itself) - this is what
    // lets a domain that went bad and got dropped stay visible instead of disappearing.
    let retiredEntries: DomainHealthEntry[] = [];
    try {
        const priorChecks = await (prisma as any).domainAuthenticationCheck.findMany({
            where: {
                teamId,
                domain: { notIn: activeDomains.length ? activeDomains : ["__none__"] },
            },
            orderBy: { updatedAt: "desc" },
        });
        const seen = new Set<string>();
        const retiredDomains: string[] = [];
        for (const check of priorChecks) {
            if (!seen.has(check.domain)) {
                seen.add(check.domain);
                retiredDomains.push(check.domain);
            }
        }
        retiredEntries = await Promise.all(
            retiredDomains.map(async (domain) => {
                const priorCheck = priorChecks.find((c: any) => c.domain === domain);
                const signals = await checkAndRecordDomain(teamId, domain, false);
                const score = domainScore(signals, false, 0, 0);
                return {
                    domain,
                    ...signals,
                    active: false,
                    score,
                    label: labelFor(score),
                    lastActiveAt: priorCheck?.lastActiveAt ? new Date(priorCheck.lastActiveAt).toISOString() : null,
                };
            })
        );
    } catch {
        // Best-effort - if the historical lookup fails, still return active-domain data.
    }

    let score = 100;
    if (bounceRate > 0.05) score -= 30;
    else if (bounceRate > 0.02) score -= 15;
    if (complaintRate > 0.001) score -= 25;
    else if (complaintRate > 0.0005) score -= 10;
    for (const d of activeEntries) {
        if (!d.mx) score -= 10;
        if (!d.spf) score -= 10;
        if (!d.dkim) score -= 10;
        if (!d.dmarc) score -= 10;
    }
    if (!team?.mailingAddress) score -= 5;
    score = Math.max(0, Math.min(100, score));

    return {
        windowDays: WINDOW_DAYS,
        sentCount,
        bounceRate,
        complaintRate,
        openRate,
        unsubscribeRate,
        score,
        oneClickUnsubscribeActive: true,
        mailingAddressConfigured: Boolean(team?.mailingAddress),
        domains: [...activeEntries, ...retiredEntries],
    };
}
