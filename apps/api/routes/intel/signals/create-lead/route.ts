import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import {
    queueNetjanaFollowup,
    shouldQueueNetjanaFollowup,
    type NormalizedNetjanaSignal,
} from "@/modules/intel/service/netjanaIntelService";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const signalId = typeof body?.signalId === "string" ? body.signalId.trim() : "";
    if (!signalId) {
        return NextResponse.json({ ok: false, error: "signalId is required" }, { status: 400 });
    }

    const shadowSignal = await prisma.shadowSignal.findFirst({
        where: {
            id: signalId,
            teamId,
            source: "netjana-intel",
        },
    });

    if (!shadowSignal) {
        return NextResponse.json({ ok: false, error: "Signal not found" }, { status: 404 });
    }

    if (shadowSignal.leadId) {
        return NextResponse.json(
            { ok: false, error: "Signal is already linked to a lead", leadId: shadowSignal.leadId },
            { status: 409 }
        );
    }

    const metadata = (typeof shadowSignal.metadata === "object" && shadowSignal.metadata !== null)
        ? (shadowSignal.metadata as Record<string, any>)
        : {};

    const companyName = typeof metadata.companyName === "string" ? metadata.companyName : "";
    if (!companyName || companyName === "Unknown company") {
        return NextResponse.json(
            { ok: false, error: "Signal has no usable company name to create a lead from" },
            { status: 422 }
        );
    }

    const normalizedSignal = metadata as NormalizedNetjanaSignal;
    const intentScore = typeof metadata.intentScore === "number" ? metadata.intentScore : 0;
    const isHotSignal = shouldQueueNetjanaFollowup(normalizedSignal);
    const now = new Date();

    const lead = await prisma.lead.create({
        data: {
            teamId,
            company: companyName,
            source: "netjana-intel",
            status: "NEW",
            intentScore: Math.max(0, Math.min(1, intentScore / 100)),
            lastScoredAt: now,
            pipelineState: isHotSignal ? "HOT" : "COLD",
            pipelineStateChangedAt: now,
            hotAt: isHotSignal ? now : null,
            marketContext: {
                netjana: {
                    companyName: metadata.companyName ?? null,
                    industry: metadata.industry ?? null,
                    buyingStage: metadata.buyingStage ?? null,
                },
            },
            enrichedData: {
                netjana: {
                    ...metadata,
                    createdFromUnmatchedSignal: true,
                    promotedBy: userId,
                    promotedAt: now.toISOString(),
                },
            },
        },
    });

    await prisma.shadowSignal.update({
        where: { id: shadowSignal.id },
        data: {
            leadId: lead.id,
            metadata: {
                ...metadata,
                matchStatus: "MATCHED",
                matchConfidence: "HIGH",
            },
        },
    });

    let followup: { queued: boolean; reason?: string; jobId?: string } = { queued: false };
    if (isHotSignal) {
        try {
            followup = await queueNetjanaFollowup(teamId, normalizedSignal, {
                id: lead.id,
                campaignId: normalizedSignal.campaignId || null,
            });
        } catch (error) {
            console.warn("[Intel] Failed to queue followup after manual lead promotion", error);
        }
    }

    return NextResponse.json({
        ok: true,
        leadId: lead.id,
        pipelineState: lead.pipelineState,
        followup,
    });
}
