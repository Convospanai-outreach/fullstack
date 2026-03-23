import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getSmtpConfig, saveSmtpConfig, deleteSmtpConfig } from "@/modules/email-campaigner/service/smtpConfigService";
import { z } from "zod";

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
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = await getSmtpConfig(ctx.teamId);
    return NextResponse.json(config ?? null);
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = SmtpSchema.safeParse(body.config ?? body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    await saveSmtpConfig(ctx.teamId, parsed.data);
    return NextResponse.json({ success: true });
}

export async function DELETE() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await deleteSmtpConfig(ctx.teamId);
    return NextResponse.json({ success: true });
}
