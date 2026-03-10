import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { verifySmtpConfig } from "@/lib/email/smtpClient";
import { z } from "zod";

const SmtpVerifySchema = z.object({
    host: z.string().min(1),
    port: z.number().int().min(1),
    secure: z.boolean(),
    user: z.string().email(),
    password: z.string().min(1),
    fromName: z.string().min(1),
    fromEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = SmtpVerifySchema.safeParse(body);
        
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const result = await verifySmtpConfig(parsed.data);
        if (result.ok) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
