import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { handleEmailSending } from "@/workers/handlers/email-sending-worker";

export const dynamic = "force-dynamic";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const { action, reason } = body;

        const approval = await prisma.approvalRequest.findUnique({
            where: { id },
        });

        if (!approval || approval.teamId !== ctx.teamId) {
            return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
        }

        if (action === "REJECT") {
            const updated = await prisma.approvalRequest.update({
                where: { id },
                data: {
                    status: "REJECTED",
                    reviewerId: ctx.userId,
                    reviewedAt: new Date(),
                    reviewNote: reason || "Rejected by reviewer",
                },
            });
            return NextResponse.json({ success: true, approval: updated });
        }

        // Action === "APPROVE"
        const updated = await prisma.approvalRequest.update({
            where: { id },
            data: {
                status: "APPROVED",
                reviewerId: ctx.userId,
                reviewedAt: new Date(),
            },
        });

        // Trigger real email send execution if this approval was for an email or draft send
        let sendResult = null;
        if (approval.entityType === "Email" || approval.entityType === "Lead" || approval.actionType.includes("SEND") || approval.actionType.includes("DRAFT")) {
            const payload = (approval.payload as any) || {};
            const leadId = payload.leadId || approval.entityId;
            const campaignId = payload.campaignId;

            if (leadId && campaignId) {
                try {
                    sendResult = await handleEmailSending({
                        leadId,
                        campaignId,
                        teamId: ctx.teamId,
                        mailboxId: payload.mailboxId,
                        subject: payload.subject,
                        body: payload.body,
                    });
                } catch (sendErr: any) {
                    console.error("[Approval Send Failure]", sendErr);
                    return NextResponse.json({
                        success: false,
                        error: `Approved, but Gmail send failed: ${sendErr?.message || sendErr}`,
                    }, { status: 500 });
                }
            }
        }

        return NextResponse.json({ success: true, approval: updated, sendResult });
    } catch (error: any) {
        console.error("Failed to process approval:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
