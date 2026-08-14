import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const LINKEDIN_STEP_TYPES = new Set([
    "CHAT_MESSAGE",
    "VISIT_PROFILE",
    "LI_WITHDRAW",
    "LI_VISIT",
    "LI_INVITE",
    "LI_CHAT",
    "LI_VOICE",
]);

const StepSchema = z.object({
    id: z.string().optional(),
    stepType: z.string().min(1),
    stepOrder: z.number().int().min(0),
    delayDays: z.number().int().min(0).default(0),
    delayHours: z.number().int().min(0).default(0),
    subject: z.string().optional(),
    body: z.string().optional(),
});

const SaveSequenceSchema = z.object({
    steps: z.array(StepSchema),
    senderMailboxIds: z.array(z.string()).default([]),
    timezone: z.string().default("UTC"),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");
        const { FeatureFlagService } = await import("@/lib/flags/service");
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
            include: { steps: { orderBy: { stepOrder: "asc" } } },
        });

        const linkedinEnabled = await FeatureFlagService.isEnabled("linkedin_automation", teamId);

        return NextResponse.json({
            success: true,
            sequence: sequence
                ? {
                    id: sequence.id,
                    name: sequence.name,
                    status: sequence.status,
                    timezone: sequence.timezone,
                    senderMailboxIds: sequence.senderMailboxIds,
                }
                : null,
            steps: sequence?.steps || [],
            linkedinLocked: !linkedinEnabled,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");
        const { FeatureFlagService } = await import("@/lib/flags/service");
        const { id: campaignId } = await params;
        const body = await req.json();

        const validation = SaveSequenceSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
        }
        const { steps, senderMailboxIds, timezone } = validation.data;

        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId },
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        const usesLinkedIn = steps.some((s) => LINKEDIN_STEP_TYPES.has(s.stepType));
        if (usesLinkedIn) {
            const linkedinEnabled = await FeatureFlagService.isEnabled("linkedin_automation", teamId);
            if (!linkedinEnabled) {
                return NextResponse.json({ error: "LinkedIn steps are not enabled for this team" }, { status: 403 });
            }
        }

        if (senderMailboxIds.length > 0) {
            const validMailboxes = await prisma.connectedMailbox.count({
                where: { id: { in: senderMailboxIds }, teamId },
            });
            if (validMailboxes !== senderMailboxIds.length) {
                return NextResponse.json({ error: "One or more senders do not belong to this team" }, { status: 400 });
            }
        }

        const sequence = await prisma.$transaction(async (tx) => {
            const existing = await tx.campaignSequence.findFirst({
                where: { campaignId, teamId },
                orderBy: { createdAt: "asc" },
            });

            const seq = existing
                ? await tx.campaignSequence.update({
                    where: { id: existing.id },
                    data: { senderMailboxIds, timezone },
                })
                : await tx.campaignSequence.create({
                    data: {
                        teamId,
                        campaignId,
                        name: `${campaign.name} sequence`,
                        senderMailboxIds,
                        timezone,
                    },
                });

            // Diff against existing steps instead of delete-all-then-recreate: SequenceStepRun
            // cascade-deletes when its SequenceStep is deleted, so blindly replacing every row
            // on every save would silently destroy send history/audit trail and orphan any
            // already-SCHEDULED run for a lead currently enrolled in this sequence.
            const existingSteps = await tx.sequenceStep.findMany({ where: { sequenceId: seq.id } });
            const existingIds = new Set(existingSteps.map((s) => s.id));
            const incomingIds = new Set(steps.filter((s) => s.id && existingIds.has(s.id)).map((s) => s.id!));

            const idsToDelete = existingSteps.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);
            if (idsToDelete.length > 0) {
                await tx.sequenceStep.deleteMany({ where: { id: { in: idsToDelete } } });
            }

            const toUpdate = steps.filter((s) => s.id && existingIds.has(s.id));
            const toCreate = steps.filter((s) => !(s.id && existingIds.has(s.id)));

            // Two-phase update: move updated steps to out-of-range negative orders first, so
            // reordering two existing steps against each other can't collide with the
            // [sequenceId, stepOrder] unique constraint mid-loop.
            for (let i = 0; i < toUpdate.length; i++) {
                await tx.sequenceStep.update({ where: { id: toUpdate[i]!.id! }, data: { stepOrder: -(i + 1) } });
            }
            for (const s of toUpdate) {
                await tx.sequenceStep.update({
                    where: { id: s.id! },
                    data: {
                        stepOrder: s.stepOrder,
                        stepType: s.stepType,
                        delayDays: s.delayDays,
                        delayHours: s.delayHours,
                        subject: s.subject ?? null,
                        body: s.body ?? null,
                    },
                });
            }

            for (const s of toCreate) {
                await tx.sequenceStep.create({
                    data: {
                        teamId,
                        sequenceId: seq.id,
                        stepOrder: s.stepOrder,
                        stepType: s.stepType,
                        delayDays: s.delayDays,
                        delayHours: s.delayHours,
                        subject: s.subject ?? null,
                        body: s.body ?? null,
                    },
                });
            }

            return seq;
        });

        const savedSteps = await prisma.sequenceStep.findMany({
            where: { sequenceId: sequence.id },
            orderBy: { stepOrder: "asc" },
        });

        return NextResponse.json({ success: true, sequence, steps: savedSteps });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
