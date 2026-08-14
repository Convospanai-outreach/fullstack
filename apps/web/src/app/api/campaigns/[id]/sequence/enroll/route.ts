import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Must mirror sequenceService.ts's normalize()/stepType() on apps/api exactly: trim, lowercase,
// hyphens to underscores. That engine only ever advances these four types; anything else hard-fails
// a step run with UNSUPPORTED_STEP_TYPE and leaves the enrollment stuck in "SCHEDULING" forever,
// with no automated exit or retry - so this must be an allowlist of what's known-safe, not a
// denylist of LinkedIn step names (older rows can carry other stray/legacy values entirely).
const SUPPORTED_STEP_TYPES = new Set(["email", "condition", "delay", "manual_review"]);
function normalizedStepType(stepType: string) {
    return stepType.trim().toLowerCase().replace(/-/g, "_");
}

function firstStepDelayMs(step: { delayDays: number; delayHours: number }) {
    return (step.delayDays * 24 + step.delayHours) * 60 * 60 * 1000;
}

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

        const unsupportedStep = sequence.steps.find((s) => !SUPPORTED_STEP_TYPES.has(normalizedStepType(s.stepType)));
        if (unsupportedStep) {
            return NextResponse.json(
                {
                    error: `Cannot enroll leads yet: step ${unsupportedStep.stepOrder + 1} ("${unsupportedStep.stepType}") is not a type sequence execution supports (only email/condition/delay/manual_review). Remove or replace it before enrolling.`,
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
        const firstStep = sequence.steps[0]!;
        const nextRunAt = new Date(now.getTime() + firstStepDelayMs(firstStep));
        const result = await prisma.sequenceEnrollment.createMany({
            data: leads.map((lead) => ({
                teamId,
                sequenceId: sequence.id,
                leadId: lead.id,
                campaignId,
                status: "ACTIVE",
                currentStepOrder: 0,
                nextRunAt,
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
