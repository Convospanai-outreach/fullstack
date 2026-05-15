import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { GmailMailboxService } from "@/lib/gmailMailboxService";

export async function POST(req: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");

        const body = await req.json();
        const to = typeof body.to === "string" ? body.to.trim() : "";
        const teamId = typeof body.teamId === "string" ? body.teamId : "";
        if (!to || !teamId) throw new APIError("teamId and to are required", 400, "BAD_REQUEST");

        const membership = await prisma.teamMember.findFirst({ where: { teamId, userId: admin.id } });
        if (!membership) throw new APIError("Forbidden for this team", 403, "FORBIDDEN");

        const result = await GmailMailboxService.sendCampaignEmail({
            teamId,
            to,
            subject: "ConvoSpan Gmail mailbox test",
            html: "<p>Your ConvoSpan Gmail mailbox is connected and ready for campaign sending.</p>",
        });
        if (!result) throw new APIError("No active Gmail mailbox is connected for this team", 404, "MAILBOX_NOT_FOUND");
        if (!result.success) throw new APIError(result.error || "Test send failed", 502, "GMAIL_SEND_FAILED");

        return NextResponse.json({ success: true, messageId: result.providerId });
    } catch (error: any) {
        return handleAPIError(error);
    }
}

