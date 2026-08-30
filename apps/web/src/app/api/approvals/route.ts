import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { ApprovalService } from "@/modules/governance/ApprovalService";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { prisma } = await import("@/lib/db");
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Self-healing: Backfill orphaned drafts into ApprovalRequests automatically
        const existingApprovals = await prisma.approvalRequest.findMany({
            where: { teamId: ctx.teamId },
            select: { entityId: true, payload: true },
        });

        const existingEmailIds = new Set<string>();
        for (const a of existingApprovals) {
            if (a.entityId) existingEmailIds.add(a.entityId);
            const payloadEmailId = (a.payload as any)?.emailId;
            if (payloadEmailId) existingEmailIds.add(payloadEmailId);
        }

        const draftEmails = await prisma.email.findMany({
            where: {
                lead: { teamId: ctx.teamId },
                status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] },
            },
            include: { lead: true },
        });

        for (const email of draftEmails) {
            if (!existingEmailIds.has(email.id)) {
                await ApprovalService.requestEntityApproval(
                    "email",
                    email.id,
                    ctx.teamId,
                    "email_draft_approval",
                    {
                        emailId: email.id,
                        leadId: email.leadId,
                        campaignId: email.campaignId,
                        subject: email.subject,
                        body: email.body,
                        recipient: email.lead?.email,
                    },
                    ctx.userId
                ).catch((err) => {
                    console.error("[Approvals Backfill] Failed to create self-healing ApprovalRequest:", err?.message || err);
                });
            }
        }

        const requests = await prisma.approvalRequest.findMany({
            where: {
                teamId: ctx.teamId,
                status: "PENDING",
            },
            include: {
                requester: {
                    select: {
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error("Failed to fetch approvals:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
