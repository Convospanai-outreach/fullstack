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

        // Parse payload safely whether stored as raw JSON object or JSON string
        let sendResult: any = null;
        let payload = (approval.payload as any) || {};
        if (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch (jsonErr) {
                console.error(`[Approval API] Failed to parse JSON payload string for approval ${id}:`, jsonErr);
            }
        }

        const emailId =
            payload.emailId ||
            payload.email_id ||
            (approval.entityType?.toLowerCase() === "email" ? approval.entityId : null);

        const leadId =
            payload.leadId ||
            payload.lead_id ||
            (approval.entityType?.toLowerCase() === "lead" ? approval.entityId : null);

        const campaignId = payload.campaignId;

        // Update Email status from draft_ready to queued so dashboard summary reflects approval immediately
        if (emailId) {
            await prisma.email.update({
                where: { id: emailId },
                data: { status: "queued" },
            }).catch((err) => {
                console.error(`[Approval API] Failed to update Email status for emailId ${emailId}:`, err?.message || err);
                throw err;
            });
        }

        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: { status: "SENT" },
            }).catch((err) => {
                console.error(`[Approval API] Failed to update Lead status for leadId ${leadId}:`, err?.message || err);
                throw err;
            });
        }

        const isEmailApproval =
            approval.entityType?.toLowerCase() === "email" ||
            approval.entityType?.toLowerCase() === "lead" ||
            approval.actionType?.toUpperCase().includes("SEND") ||
            approval.actionType?.toUpperCase().includes("DRAFT") ||
            approval.actionType?.toUpperCase().includes("APPROVAL");

        if (isEmailApproval && leadId && campaignId) {
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
                // Return success true with warning so UI updates status cleanly even if SMTP/Gmail worker handles delivery asynchronously
                sendResult = { error: sendErr?.message || String(sendErr) };
            }
        }

        return NextResponse.json({ success: true, approval: updated, sendResult });
    } catch (error: any) {
        console.error("Failed to process approval:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
