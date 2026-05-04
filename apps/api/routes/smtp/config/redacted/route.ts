import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getSmtpConfigRedacted } from "@/modules/email-campaigner/service/smtpConfigService";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const config = await getSmtpConfigRedacted(ctx.teamId);
    return NextResponse.json(config ?? null);
}
