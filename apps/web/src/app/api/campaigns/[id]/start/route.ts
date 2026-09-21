import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { enrollCampaignLeads } from "@/lib/campaigns/enrollment";
import { handleCampaignExecution } from "@/workers/handlers/campaign-execution-worker";

export const dynamic = "force-dynamic";

/**
 * Unified "start outreach" action (roadmap 2.12 / B-12).
 *
 * The campaign detail page previously had two divergent start paths: "Activate"
 * (which flipped status then fire-and-forgot POST /run, swallowing failures) and
 * the Sequence tab's "Enroll". This routes both to one guarded action: if the
 * campaign has a saved sequence with runnable steps, enrol its leads into that
 * sequence; otherwise fall back to the direct one-draft-per-lead path (/run's
 * worker). Either way the campaign is marked active only when the start actually
 * succeeds, and any failure is returned to the caller instead of being logged
 * and dropped.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const { prisma } = await import("@/lib/db");
        const { id: campaignId } = await params;

        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId },
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        const enroll = await enrollCampaignLeads(campaignId, teamId);

        if (enroll.ok) {
            // A saved, runnable sequence exists → enrolment is the start. Mark the
            // campaign active only now that the enrolment succeeded.
            await prisma.campaign.update({ where: { id: campaignId }, data: { status: "active" } });
            return NextResponse.json({
                success: true,
                mode: "sequence",
                status: "active",
                candidates: enroll.candidates,
                enrolled: enroll.enrolled,
                alreadyEnrolled: enroll.alreadyEnrolled,
                ...(enroll.message ? { message: enroll.message } : {}),
            });
        }

        if (enroll.code === "UNSUPPORTED_STEP") {
            // The user built a sequence but it can't run yet — surface it rather
            // than silently falling back to the direct-draft path.
            return NextResponse.json({ error: enroll.error }, { status: 400 });
        }

        // NO_SEQUENCE → direct one-draft-per-lead path (sets status active itself).
        // Guard the empty case here: handleCampaignExecution falls back to drafting
        // for up to 10 arbitrary team leads when a campaign has none assigned. That
        // was a latent footgun while Activate fire-and-forgot /run; now that /start
        // awaits and reports it, refuse rather than draft to leads nobody selected.
        const leadCount = await prisma.lead.count({ where: { campaignId, teamId } });
        if (leadCount === 0) {
            return NextResponse.json(
                { error: "This campaign has no leads and no sequence. Assign leads or build a sequence before starting." },
                { status: 400 },
            );
        }

        const result = await handleCampaignExecution({ campaignId, teamId, userId });
        return NextResponse.json({
            success: true,
            mode: "draft",
            status: "active",
            enqueued: result.enqueued,
        });
    } catch (error: any) {
        console.error("POST /api/campaigns/[id]/start error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
