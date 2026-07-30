import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

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
            where: { teamId: ctx.teamId, status: "PENDING" },
            select: { payload: true },
        });

        const pendingEmailIds = new Set(
            existingApprovals
                .map((a: any) => (a.payload as any)?.emailId)
                .filter(Boolean)
        );

        const draftEmails = await prisma.email.findMany({
            where: {
                lead: { teamId: ctx.teamId },
                status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] },
            },
            include: { lead: true },
        });

        for (const email of draftEmails) {
            if (!pendingEmailIds.has(email.id)) {
                await prisma.approvalRequest.create({
                    data: {
                        teamId: ctx.teamId,
                        requesterId: ctx.userId,
                        actionType: "email_draft_approval",
                        entityType: "email",
                        entityId: email.id,
                        status: "PENDING",
                        payload: {
                            emailId: email.id,
                            leadId: email.leadId,
                            campaignId: email.campaignId,
                            subject: email.subject,
                            body: email.body,
                            recipient: email.lead?.email,
                        },
                    },
                }).catch(() => {});
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
