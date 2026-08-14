import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { LINKEDIN_STEP_TYPES } from "../route";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");
        const { id: campaignId } = await params;

        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId },
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        const sequence = await prisma.campaignSequence.findFirst({
            where: { campaignId, teamId },
            orderBy: { createdAt: "asc" },
            include: { steps: { where: { status: "ACTIVE" }, orderBy: { stepOrder: "asc" } } },
        });
        if (!sequence || sequence.steps.length === 0) {
            return NextResponse.json({ error: "This campaign has no sequence steps to enroll leads into" }, { status: 400 });
        }

        // Sequence execution only supports EMAIL steps today (see SequenceService.processDue) -
        // a LinkedIn step hard-fails its run with UNSUPPORTED_STEP_TYPE and leaves the enrollment
        // stuck in "SCHEDULING" forever, with no automated exit or retry. Refuse enrollment
        // up front rather than create enrollments that can never complete.
        const linkedinStep = sequence.steps.find((s) => LINKEDIN_STEP_TYPES.has(s.stepType));
        if (linkedinStep) {
            return NextResponse.json(
                {
                    error: `Cannot enroll leads yet: step ${linkedinStep.stepOrder + 1} ("${linkedinStep.stepType}") is a LinkedIn step, which sequence execution does not support. Remove or replace it before enrolling.`,
                },
                { status: 400 },
            );
        }

        const leads = await prisma.lead.findMany({
            where: { campaignId, teamId },
            select: { id: true },
        });
        if (leads.length === 0) {
            return NextResponse.json({ success: true, candidates: 0, enrolled: 0, message: "No leads are assigned to this campaign" });
        }

        const now = new Date();
        const result = await prisma.sequenceEnrollment.createMany({
            data: leads.map((lead) => ({
                teamId,
                sequenceId: sequence.id,
                leadId: lead.id,
                campaignId,
                status: "ACTIVE",
                currentStepOrder: 0,
                nextRunAt: now,
            })),
            skipDuplicates: true,
        });

        if (sequence.status !== "ACTIVE") {
            await prisma.campaignSequence.update({ where: { id: sequence.id }, data: { status: "ACTIVE" } });
        }

        return NextResponse.json({
            success: true,
            candidates: leads.length,
            enrolled: result.count,
            alreadyEnrolled: leads.length - result.count,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
