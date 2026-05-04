import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getSmtpConfigRedacted, saveSmtpConfig, deleteSmtpConfig } from "@/modules/email-campaigner/service/smtpConfigService";
import { z } from "zod";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";

const SmtpSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().min(1),
    secure: z.boolean(),
    user: z.string().email(),
    password: z.string().min(1),
    fromName: z.string().min(1),
    fromEmail: z.string().email(),
});

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const config = await getSmtpConfigRedacted(ctx.teamId);
    return NextResponse.json(config ?? null);
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SmtpSchema.safeParse(body.config ?? body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    await saveSmtpConfig(ctx.teamId, parsed.data);
    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "SMTP_CONFIG_SAVED",
        entity: "SmtpConfig",
        entityId: ctx.teamId,
        metadata: {
            host: parsed.data.host,
            port: parsed.data.port,
            secure: parsed.data.secure,
            user: parsed.data.user,
            fromEmail: parsed.data.fromEmail
        }
    });
    return NextResponse.json({ success: true });
}

export async function DELETE() {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await deleteSmtpConfig(ctx.teamId);
    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "SMTP_CONFIG_DELETED",
        entity: "SmtpConfig",
        entityId: ctx.teamId,
        metadata: {}
    });
    return NextResponse.json({ success: true });
}
