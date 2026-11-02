import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkDomainDeliverabilitySignals } from "@/modules/email-campaigner/service/domainAuthService";

// Daily check of every sending domain (the domain of each connected mailbox). It remembers the last
// result per domain in a DomainAuthenticationCheck row of its own, so it can tell a domain that went
// down from one whose DNS has simply not been set up yet:
//   VERIFIED  all of SPF, DKIM, DMARC and MX passed last time
//   PENDING   has not passed yet; new domains take 24 to 48 hours, so no alarm before the grace period
//   ALERTED   an alarm went out and the domain has not passed since, so it does not alarm again
// An alarm is an advisory OverseerNudge (stage holds the domain) plus a notification and email to the
// team owner. Nothing is changed or paused.

const WATCH_PROVIDER = "OVERSEER_WATCH";
export const DOMAIN_NUDGE_TYPE = "DOMAIN_HEALTH";
const GRACE_MS = 48 * 60 * 60 * 1000;

type Signals = { mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean };

const RECORD_NAMES: Array<[keyof Signals, string]> = [
    ["spf", "SPF"],
    ["dkim", "DKIM"],
    ["dmarc", "DMARC"],
    ["mx", "MX"],
];

export function failingRecords(signals: Signals): string[] {
    return RECORD_NAMES.filter(([key]) => !signals[key]).map(([, name]) => name);
}

async function notifyOwners(teamId: string, title: string, message: string) {
    const members = await prisma.teamMember.findMany({
        where: { teamId, status: "active", role: { in: ["owner", "OWNER", "admin", "ADMIN"] }, userId: { not: null } },
        select: { userId: true, role: true },
    });
    const owners = members.filter((m) => m.role.toLowerCase() === "owner");
    const targets = owners.length > 0 ? owners : members;
    const { NotificationDispatcher } = await import("@/lib/notifications");
    for (const member of targets) {
        await NotificationDispatcher.send(member.userId as string, "SYSTEM", title, message, { teamId });
    }
}

export async function runDomainWatch(now = new Date()): Promise<{ domainsChecked: number; alarms: number }> {
    const db = prisma as any;
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { status: "CONNECTED" },
        select: { teamId: true, email: true, provider: true },
    });

    // domain -> provider of the first mailbox on it, per team
    const domainsByTeam = new Map<string, Map<string, string>>();
    for (const mailbox of mailboxes) {
        const domain = mailbox.email.split("@")[1]?.toLowerCase();
        if (!domain) continue;
        if (!domainsByTeam.has(mailbox.teamId)) domainsByTeam.set(mailbox.teamId, new Map());
        const byDomain = domainsByTeam.get(mailbox.teamId)!;
        if (!byDomain.has(domain)) byDomain.set(domain, mailbox.provider);
    }

    let domainsChecked = 0;
    let alarms = 0;

    for (const [teamId, domains] of domainsByTeam) {
        for (const [domain, provider] of domains) {
            let signals: Signals;
            try {
                signals = await checkDomainDeliverabilitySignals(domain, provider);
            } catch {
                // A lookup that could not run says nothing about the domain; try again tomorrow.
                continue;
            }
            domainsChecked += 1;

            const key = { teamId_domain_provider: { teamId, domain, provider: WATCH_PROVIDER } };
            const prior = await db.domainAuthenticationCheck.findUnique({ where: key });
            const failing = failingRecords(signals);

            if (failing.length === 0) {
                await db.domainAuthenticationCheck.upsert({
                    where: key,
                    create: { teamId, domain, provider: WATCH_PROVIDER, status: "VERIFIED", lastCheckedAt: now },
                    update: { status: "VERIFIED", lastCheckedAt: now, failureReason: null },
                });
                // Back to healthy: close any alarm still open for it.
                await prisma.overseerNudge.updateMany({
                    where: { teamId, nudgeType: DOMAIN_NUDGE_TYPE, stage: domain, status: "OPEN" },
                    data: { status: "DISMISSED" },
                });
                continue;
            }

            const failureReason = failing.join(", ");
            const wasVerified = prior?.status === "VERIFIED";
            const pastGrace = !!prior && prior.status === "PENDING" && now.getTime() - new Date(prior.createdAt).getTime() >= GRACE_MS;

            if (!prior || prior.status === "ALERTED" || (!wasVerified && !pastGrace)) {
                // First sighting, already alarmed, or still inside the 24 to 48 hour wait.
                await db.domainAuthenticationCheck.upsert({
                    where: key,
                    create: { teamId, domain, provider: WATCH_PROVIDER, status: "PENDING", lastCheckedAt: now, failureReason },
                    update: { lastCheckedAt: now, failureReason },
                });
                continue;
            }

            const suggestion = wasVerified
                ? `${domain} has stopped passing its email checks (${failureReason}). Mail from it may land in spam. Fix the DNS records, or connect a mailbox on another domain.`
                : `${domain} still fails ${failureReason} after 48 hours. Mail from it may land in spam. Check the DNS records you added, or connect a mailbox on another domain.`;

            await prisma.overseerNudge.create({
                data: { teamId, stage: domain, stallDays: 0, nudgeType: DOMAIN_NUDGE_TYPE, suggestion },
            });
            await db.domainAuthenticationCheck.upsert({
                where: key,
                create: { teamId, domain, provider: WATCH_PROVIDER, status: "ALERTED", lastCheckedAt: now, failureReason },
                update: { status: "ALERTED", lastCheckedAt: now, failureReason },
            });
            alarms += 1;

            try {
                await notifyOwners(teamId, `Sending domain ${domain} needs attention`, `${suggestion} Details: https://craftmyfunnel.live/settings/domain-health`);
            } catch (err) {
                logger.error("[DomainWatch] Failed to notify team owner", { teamId, domain, error: (err as Error).message });
            }
        }
    }

    return { domainsChecked, alarms };
}
