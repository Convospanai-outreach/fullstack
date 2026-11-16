import { prisma } from "@/lib/db";
import { normalizeHost } from "@/lib/linkHosts";

// What a team's autopilot drafts may link to or mention: the hosts the team owns and the contact
// details of the lead and the sender. Read fresh each time so a just-added domain counts at once.

const MAX_BOOKING_URLS = 50;

export type HoldbackContext = {
    ownedHosts: string[];
    knownContacts: { emails: string[]; phones: string[] };
};

const emailDomain = (email: string) => email.split("@")[1] ?? "";

export async function loadHoldbackContext(teamId: string, leadId: string): Promise<HoldbackContext> {
    const [domains, authChecks, mailboxes, runs, lead] = await Promise.all([
        prisma.customDomain.findMany({ where: { teamId }, select: { domain: true } }),
        prisma.domainAuthenticationCheck.findMany({ where: { teamId }, select: { domain: true } }),
        prisma.connectedMailbox.findMany({ where: { teamId }, select: { email: true } }),
        prisma.playbookRun.findMany({ where: { teamId, bookingUrl: { not: null } }, select: { bookingUrl: true }, take: MAX_BOOKING_URLS }),
        prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { email: true, phone: true } }),
    ]);

    const appBase = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || process.env["NEXT_PUBLIC_APP_URL"] || "";
    const ownedHosts = [
        ...domains.map((d) => d.domain),
        ...authChecks.map((d) => d.domain),
        ...mailboxes.map((m) => emailDomain(m.email)),
        ...runs.map((r) => r.bookingUrl ?? ""),
        appBase,
    ]
        .map(normalizeHost)
        .filter(Boolean);

    return {
        ownedHosts: [...new Set(ownedHosts)],
        knownContacts: {
            emails: [...mailboxes.map((m) => m.email), ...(lead?.email ? [lead.email] : [])],
            phones: lead?.phone ? [lead.phone] : [],
        },
    };
}
