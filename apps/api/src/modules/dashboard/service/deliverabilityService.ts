import { prisma } from "@/lib/db";
import { checkDomainDeliverabilitySignals } from "@/modules/email-campaigner/service/domainAuthService";

const WINDOW_DAYS = 30;

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
    domains: Array<{ domain: string; mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean }>;
};

function rate(count: number, total: number): number {
    return total > 0 ? count / total : 0;
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

    const uniqueDomains = Array.from(
        new Set(mailboxes.map((m) => m.email.split("@")[1]?.toLowerCase()).filter((d): d is string => Boolean(d)))
    );
    const domains = await Promise.all(
        uniqueDomains.map(async (domain) => {
            try {
                const result = await checkDomainDeliverabilitySignals(domain);
                return result;
            } catch {
                return { domain, mx: false, spf: false, dkim: false, dmarc: false };
            }
        })
    );

    let score = 100;
    if (bounceRate > 0.05) score -= 30;
    else if (bounceRate > 0.02) score -= 15;
    if (complaintRate > 0.001) score -= 25;
    else if (complaintRate > 0.0005) score -= 10;
    for (const d of domains) {
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
        domains,
    };
}
