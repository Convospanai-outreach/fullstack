import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { recordSuppression } from "@/modules/email-campaigner/service/googleMailboxService";
import { audit } from "@/lib/governance/audit";
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

// Lets this address be emailed again, so admin-only and audit-logged.
export async function DELETE(req: NextRequest) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const entry = await prisma.suppressionEntry.findFirst({
        where: { id, teamId: ctx.teamId },
        select: { id: true, email: true, reason: true, source: true },
    });
    if (!entry) {
        return NextResponse.json({ error: "Suppression not found" }, { status: 404 });
    }

    await prisma.suppressionEntry.deleteMany({ where: { id: entry.id, teamId: ctx.teamId } });
    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "REMOVE_SUPPRESSION",
        entity: "SuppressionEntry",
        entityId: entry.id,
        metadata: { email: entry.email, reason: entry.reason, source: entry.source },
    });
    return NextResponse.json({ removed: true });
}
