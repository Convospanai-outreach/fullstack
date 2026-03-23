import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { emailService } from "@/modules/email-campaigner";

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { to, subject, html, leadId, campaignId, fromName, fromEmail } = body;

        if (!to || !subject || !html) {
            return NextResponse.json({ error: "Missing to, subject, or html" }, { status: 400 });
        }

        const result = await emailService.sendEmail(
            to,
            subject,
            html,
            {
                teamId: ctx.teamId,
                leadId,
                campaignId,
                fromName,
                fromEmail
            }
        );

        if (result.success) {
            return NextResponse.json({ success: true, messageId: result.providerId });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (err: any) {
        console.error("[Email Send API] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
