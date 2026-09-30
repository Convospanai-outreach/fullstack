import { prisma } from "@/lib/db";
import { localDate } from "@/modules/inbox/localDay";

// Server-side product analytics: four retention events sent to PostHog with posthog-node.
// A no-op unless POSTHOG_API_KEY is set. Callers fire these with `void` after their own
// work is done; every function here swallows its own errors.
//
// "Once" events are claimed with a conditional update (set only while still null / not
// today), so they fire exactly once across restarts and both API VMs. Nothing is claimed
// while PostHog is unconfigured, so no milestone is used up without being sent.

export const POSITIVE_OUTCOMES = new Set(["interested", "meeting_booked"]);
const ACTIVATION_SWEEP_BATCH = 100;

type Properties = Record<string, unknown>;
type Capture = (event: { distinctId: string; event: string; properties: Properties; timestamp?: Date }) => Promise<void>;

let capture: Capture | null | undefined;

async function getCapture(): Promise<Capture | null> {
    if (capture !== undefined) return capture;
    const apiKey = process.env["POSTHOG_API_KEY"];
    if (!apiKey) return (capture = null);
    const { PostHog } = await import("posthog-node");
    const client = new PostHog(apiKey, { host: process.env["POSTHOG_HOST"] || "https://us.i.posthog.com" });
    return (capture = (event) => client.captureImmediate(event));
}

async function track(distinctId: string, event: string, properties: Properties, timestamp?: Date) {
    try {
        const send = await getCapture();
        if (send) await send({ distinctId, event, properties: { ...properties, source: "api" }, ...(timestamp ? { timestamp } : {}) });
    } catch (error) {
        console.error(`[ProductEvents] ${event} failed:`, error instanceof Error ? error.message : error);
    }
}

/** session_active_day: at most once per user per IST day (Home or Action Inbox opened). */
export async function markActiveDay(userId: string, teamId: string, now = new Date()) {
    try {
        if (!(await getCapture())) return;
        const today = localDate(now);
        const claimed = await prisma.user.updateMany({
            where: { id: userId, OR: [{ lastActiveDay: null }, { lastActiveDay: { not: today } }] },
            data: { lastActiveDay: today },
        });
        if (claimed.count) await track(userId, "session_active_day", { team_id: teamId });
    } catch (error) {
        console.error("[ProductEvents] session_active_day failed:", error instanceof Error ? error.message : error);
    }
}

/** aha_first_positive_reply: the first time anyone on the team marks a reply interested or meeting booked. */
export async function markFirstPositiveReply(teamId: string, userId: string, outcome: string, now = new Date()) {
    if (!POSITIVE_OUTCOMES.has(outcome)) return;
    try {
        if (!(await getCapture())) return;
        const claimed = await prisma.team.updateMany({ where: { id: teamId, firstPositiveReplyAt: null }, data: { firstPositiveReplyAt: now } });
        if (claimed.count) await track(userId, "aha_first_positive_reply", { team_id: teamId, outcome });
    } catch (error) {
        console.error("[ProductEvents] aha_first_positive_reply failed:", error instanceof Error ? error.message : error);
    }
}

/** meeting_booked: every meeting created in the app. */
export async function trackMeetingBooked(teamId: string, userId: string | null, meetingId: string) {
    await track(userId ?? `team:${teamId}`, "meeting_booked", { team_id: teamId, meeting_id: meetingId });
}

/**
 * activation_first_campaign_sent: hourly worker sweep, so the campaign send path is untouched.
 * "Sent" means the email provider accepted it (Email.providerId set). The event is stamped
 * with that email's time, so teams that sent before this shipped are recorded accurately.
 */
export async function sweepFirstCampaignSends() {
    let fired = 0;
    try {
        if (!(await getCapture())) return fired;
        const teams = await prisma.team.findMany({
            where: { firstCampaignSentAt: null, campaigns: { some: { emails: { some: { providerId: { not: null } } } } } },
            select: { id: true },
            take: ACTIVATION_SWEEP_BATCH,
        });
        for (const team of teams) {
            const first = await prisma.email.findFirst({
                where: { providerId: { not: null }, campaign: { teamId: team.id } },
                orderBy: { createdAt: "asc" },
                select: { createdAt: true, campaignId: true, campaign: { select: { ownerId: true } } },
            });
            if (!first) continue;
            const claimed = await prisma.team.updateMany({
                where: { id: team.id, firstCampaignSentAt: null },
                data: { firstCampaignSentAt: first.createdAt },
            });
            if (!claimed.count) continue;
            await track(first.campaign.ownerId ?? `team:${team.id}`, "activation_first_campaign_sent", { team_id: team.id, campaign_id: first.campaignId }, first.createdAt);
            fired++;
        }
    } catch (error) {
        console.error("[ProductEvents] activation sweep failed:", error instanceof Error ? error.message : error);
    }
    return fired;
}

/** Test hook: forget the cached client so a test can change POSTHOG_API_KEY. */
export function resetProductEventsForTests() {
    capture = undefined;
}
