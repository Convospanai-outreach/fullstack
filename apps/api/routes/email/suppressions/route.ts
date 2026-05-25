import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { recordSuppression } from "@/modules/email-campaigner/service/googleMailboxService";
import { z } from "zod";

const SuppressionSchema = z.object({
    email: z.string().email(),
    reason: z.string().min(1).default("MANUAL"),
});

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const suppressions = await prisma.suppressionEntry.findMany({
        where: { teamId: ctx.teamId },
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return NextResponse.json({ suppressions });
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SuppressionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const suppression = await recordSuppression({
        teamId: ctx.teamId,
        email: parsed.data.email,
        reason: parsed.data.reason,
        source: "ADMIN",
        createdBy: ctx.userId,
    });
    return NextResponse.json({ suppression });
}
