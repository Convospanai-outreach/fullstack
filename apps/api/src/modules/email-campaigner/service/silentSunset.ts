import { prisma } from "@/lib/db";

// Strategy S5: once a day, takes a contact out of a campaign's drip when they have been in it for 90 days
// and have not opened or clicked anything in that time, so the sender stops mailing people who have gone
// quiet and protects its reputation. Only campaigns that selected S5 are touched. The lead itself is not
// changed (status, tags and history stay), so the contact can be enrolled again by hand; only the
// enrollment exits and its unsent steps are skipped. A reply, bounce or unsubscribe already ends an
// enrollment elsewhere, so only enrollments still live reach this check.

export const SUNSET_STRATEGY_ID = "S5";
export const SUNSET_AFTER_DAYS = 90;
export const SUNSET_ERROR_CODE = "SUNSET_SILENT_90D";
const ENGAGEMENT_EVENT_TYPES = ["OPEN", "CLICK"];
const LIVE_STATUSES = ["ACTIVE", "SCHEDULING"];
const RUN_DUE_STATUSES = ["SCHEDULED", "RETRY_SCHEDULED"];
const BATCH_SIZE = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runSilentSunset(now = new Date()): Promise<{ campaignsChecked: number; enrollmentsExited: number }> {
    const cutoff = new Date(now.getTime() - SUNSET_AFTER_DAYS * DAY_MS);

    const campaigns = await prisma.campaign.findMany({
        where: { aiConfig: { path: ["strategies"], array_contains: [SUNSET_STRATEGY_ID] } },
        select: { id: true, teamId: true },
    });

    let enrollmentsExited = 0;
    for (const campaign of campaigns) {
        const old = await prisma.sequenceEnrollment.findMany({
            where: {
                teamId: campaign.teamId,
                campaignId: campaign.id,
                status: { in: LIVE_STATUSES },
                startedAt: { lte: cutoff },
            },
            take: BATCH_SIZE,
            select: { id: true, leadId: true },
        });
        if (old.length === 0) continue;

        // Anyone who engaged in the window keeps their place.
        const engaged = await prisma.emailEvent.findMany({
            where: {
                teamId: campaign.teamId,
                leadId: { in: old.map((e) => e.leadId) },
                type: { in: ENGAGEMENT_EVENT_TYPES },
                createdAt: { gte: cutoff },
            },
            select: { leadId: true },
        });
        const engagedLeads = new Set(engaged.map((e) => e.leadId));
        const silent = old.filter((e) => !engagedLeads.has(e.leadId));
        if (silent.length === 0) continue;

        const ids = silent.map((e) => e.id);
        const exited = await prisma.sequenceEnrollment.updateMany({
            where: { id: { in: ids }, teamId: campaign.teamId, status: { in: LIVE_STATUSES } },
            data: { status: "EXITED", completedAt: now, cancelledAt: now, nextRunAt: null },
        });
        await prisma.sequenceStepRun.updateMany({
            where: { enrollmentId: { in: ids }, teamId: campaign.teamId, status: { in: RUN_DUE_STATUSES } },
            data: { status: "SKIPPED_EXITED", completedAt: now, errorCode: SUNSET_ERROR_CODE },
        });
        enrollmentsExited += exited.count;
    }

    return { campaignsChecked: campaigns.length, enrollmentsExited };
}
