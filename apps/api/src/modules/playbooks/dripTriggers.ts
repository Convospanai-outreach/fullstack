import { prisma } from "@/lib/db";
import { consentAllowsContact } from "@/modules/landing-agent/leadConsent";

/**
 * Starts switched-on drip playbooks (dripDraft.ts saves them as drafts). Three automatic triggers:
 *  - landing_signup: a sign-up on the landing page the owner chose (lead magnet, ebook or brochure form)
 *  - link_click: a tracked email link starting with the URL the owner chose was clicked
 *  - inactivity: a consented contact with no open or click for 90 days (win-back)
 * A playbook's settings live in Campaign.aiConfig.dripPlaybook: { kind, trigger, active, rule, cursor }.
 * Every trigger goes through enrollDrip, which never emails someone who opted out, replied, booked,
 * is suppressed, or is already in another sequence.
 */

export const WIN_BACK_AFTER_DAYS = 90;
export const WIN_BACK_PER_RUN = 25; // keeps a first run from mailing a whole old list at once
const CLICK_BATCH = 500;
const MIN_CLICK_DELAY_MS = 60_000; // mail scanners "click" within seconds of delivery; a person takes longer
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_ENROLLMENTS = ["ACTIVE", "SCHEDULING", "MANUAL_REVIEW"];
const STOP_STATUSES = new Set(["replied", "bounced", "unsubscribed", "do_not_contact", "dnc", "meeting_booked"]);
const STOP_PIPELINE = new Set(["MEETING_BOOKED", "MEETING_CONFIRMED", "BOUNCED", "UNSUBSCRIBED"]);

export type DripState = {
    kind: string;
    trigger: string;
    active?: boolean;
    rule?: { landingPageId?: string; url?: string };
    cursor?: string;
};
type DripCampaign = { id: string; teamId: string | null; aiConfig: unknown };

export const dripOf = (aiConfig: unknown) => (aiConfig as { dripPlaybook?: DripState } | null)?.dripPlaybook;

async function activeCampaigns(trigger: string, teamId?: string): Promise<(DripCampaign & { teamId: string; drip: DripState })[]> {
    const rows = await prisma.campaign.findMany({
        where: {
            ...(teamId ? { teamId } : { teamId: { not: null } }),
            AND: [{ aiConfig: { path: ["dripPlaybook", "active"], equals: true } }, { aiConfig: { path: ["dripPlaybook", "trigger"], equals: trigger } }],
        },
        select: { id: true, teamId: true, aiConfig: true },
    });
    return rows.flatMap((c) => {
        const drip = dripOf(c.aiConfig);
        return c.teamId && drip ? [{ ...c, teamId: c.teamId, drip }] : [];
    });
}

/** Why the lead was not enrolled, or null when they were. Safe to call repeatedly. */
export async function enrollDrip(
    campaign: { id: string; teamId: string },
    leadId: string,
    opts: { requireConsent: boolean; replaceCampaignId?: string | null },
): Promise<string | null> {
    const { teamId } = campaign;
    const sequence = await prisma.campaignSequence.findFirst({ where: { teamId, campaignId: campaign.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!sequence) return "playbook has no sequence";
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { email: true, status: true, pipelineState: true, consentObtained: true } });
    if (!lead) return "lead not found";
    const email = lead.email?.trim().toLowerCase();
    if (!email) return "lead has no email";
    if (STOP_STATUSES.has(lead.status.trim().toLowerCase()) || STOP_PIPELINE.has(lead.pipelineState.trim().toUpperCase())) return "lead replied, booked or opted out";
    if (await prisma.suppressionEntry.findFirst({ where: { teamId, email }, select: { id: true } })) return "email is suppressed";
    if (opts.requireConsent && !lead.consentObtained) return "no consent recorded";
    if ((await prisma.sequenceEnrollment.count({ where: { teamId, leadId, sequenceId: sequence.id } })) > 0) return "lead already went through this playbook";

    const live = await prisma.sequenceEnrollment.findMany({ where: { teamId, leadId, status: { in: LIVE_ENROLLMENTS } }, select: { campaignId: true } });
    if (live.length) {
        // A click on a link from campaign X may hand the lead from X to the follow-up, never from anything else.
        if (!opts.replaceCampaignId || !live.every((e) => e.campaignId === opts.replaceCampaignId)) return "lead is already in a sequence";
        const { SequenceService } = await import("@/modules/email-campaigner/service/sequenceService");
        await SequenceService.stopEnrollmentsForLead(teamId, leadId, "EXIT_DRIP_INTEREST");
    }
    const { enrollInNurture } = await import("@/modules/creator-funnel/nurtureProvider");
    await enrollInNurture(teamId, leadId, sequence.id);
    return null;
}

/** Intake hook: a landing-page sign-up joins the playbook switched on for that page. Returns why not, for the log. */
export async function enrollDripOnSignup(signUp: { teamId: string; landingPageId: string; rawPayload?: unknown }, leadId: string) {
    if (!consentAllowsContact(signUp.rawPayload)) return "consent not given";
    const match = (await activeCampaigns("landing_signup", signUp.teamId)).find((c) => c.drip.rule?.landingPageId === signUp.landingPageId);
    if (!match) return "no playbook for this page";
    return enrollDrip(match, leadId, { requireConsent: false });
}

async function saveCursor(campaignId: string, cursor: Date) {
    const fresh = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { aiConfig: true } });
    const config = (fresh?.aiConfig ?? {}) as { dripPlaybook?: DripState };
    if (!config.dripPlaybook) return;
    await prisma.campaign.update({ where: { id: campaignId }, data: { aiConfig: { ...config, dripPlaybook: { ...config.dripPlaybook, cursor: cursor.toISOString() } } as object } });
}

/** Every few minutes: clicks on a chosen link since the last run start the follow-up. */
export async function runLinkClickTrigger(now = new Date()) {
    let enrolled = 0;
    for (const c of await activeCampaigns("link_click")) {
        const url = c.drip.rule?.url;
        if (!url) continue;
        const since = new Date(c.drip.cursor ?? now.toISOString());
        const clicks = await prisma.emailEvent.findMany({
            where: { teamId: c.teamId, type: "CLICK", leadId: { not: null }, createdAt: { gt: since } },
            orderBy: { createdAt: "asc" },
            take: CLICK_BATCH,
            select: { leadId: true, campaignId: true, createdAt: true, payload: true },
        });
        const linkIds = [...new Set(clicks.map((e) => (e.payload as { linkId?: string } | null)?.linkId).filter((x): x is string => typeof x === "string"))];
        const links = linkIds.length
            ? await prisma.trackedLink.findMany({ where: { teamId: c.teamId, id: { in: linkIds }, destinationUrl: { startsWith: url } }, select: { id: true, createdAt: true } })
            : [];
        const linkCreated = new Map(links.map((l) => [l.id, l.createdAt.getTime()]));
        const done = new Set<string>();
        for (const click of clicks) {
            const linkId = (click.payload as { linkId?: string } | null)?.linkId;
            const created = linkId ? linkCreated.get(linkId) : undefined;
            if (created === undefined || !click.leadId || done.has(click.leadId)) continue;
            if (click.createdAt.getTime() - created < MIN_CLICK_DELAY_MS) continue;
            done.add(click.leadId);
            if ((await enrollDrip(c, click.leadId, { requireConsent: false, replaceCampaignId: click.campaignId })) === null) enrolled++;
        }
        // A full batch continues from its last event next run; otherwise everything up to now is covered.
        await saveCursor(c.id, clicks.length === CLICK_BATCH ? clicks[clicks.length - 1]!.createdAt : now);
    }
    return { enrolled };
}

/** Daily: consented contacts with no open or click for 90 days start the win-back, a few at a time. */
export async function runWinBackTrigger(now = new Date()) {
    const cutoff = new Date(now.getTime() - WIN_BACK_AFTER_DAYS * DAY_MS);
    let enrolled = 0;
    for (const c of await activeCampaigns("inactivity")) {
        const sequence = await prisma.campaignSequence.findFirst({ where: { teamId: c.teamId, campaignId: c.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
        if (!sequence) continue;
        const candidates = await prisma.lead.findMany({
            where: {
                teamId: c.teamId,
                consentObtained: true,
                email: { not: null },
                emails: { some: { createdAt: { lt: cutoff } } },
                emailEvents: { none: { type: { in: ["OPEN", "CLICK"] }, createdAt: { gte: cutoff } } },
                sequenceEnrollments: { none: { OR: [{ status: { in: LIVE_ENROLLMENTS } }, { sequenceId: sequence.id }] } },
            },
            orderBy: { createdAt: "asc" },
            take: WIN_BACK_PER_RUN * 4,
            select: { id: true },
        });
        let started = 0;
        for (const lead of candidates) {
            if (started >= WIN_BACK_PER_RUN) break;
            if ((await enrollDrip(c, lead.id, { requireConsent: true })) === null) started++;
        }
        enrolled += started;
    }
    return { enrolled };
}
