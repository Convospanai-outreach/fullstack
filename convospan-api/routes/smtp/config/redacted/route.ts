import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getSmtpConfigRedacted } from "@/modules/email-campaigner/service/smtpConfigService";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = await getSmtpConfigRedacted(ctx.teamId);
    return NextResponse.json(config ?? null);
}
