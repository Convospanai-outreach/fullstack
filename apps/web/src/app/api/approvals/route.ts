import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { internalErrorMessage } from "@/lib/internalError";

export const dynamic = "force-dynamic";

const NEEDS_ATTENTION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

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

        // Held AI messages that could not be written or sent: shown so they are not lost silently.
        const attention = await prisma.approvalRequest.findMany({
            where: {
                teamId: ctx.teamId,
                actionType: "MESSAGE_SEND",
                status: "NEEDS_ATTENTION",
                createdAt: { gt: new Date(Date.now() - NEEDS_ATTENTION_WINDOW_MS) },
            },
            select: { id: true, entityId: true, reason: true, reviewNote: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        const leadIds = [...new Set(attention.map((a) => a.entityId.split(":")[0]).filter(Boolean))];
        const leads = leadIds.length
            ? await prisma.lead.findMany({ where: { id: { in: leadIds }, teamId: ctx.teamId }, select: { id: true, fullName: true, email: true } })
            : [];
        const leadById = new Map(leads.map((l) => [l.id, l]));
        const needsAttention = attention.map((a) => {
            const [leadId, channel] = a.entityId.split(":");
            const lead = leadById.get(leadId ?? "");
            return {
                id: a.id,
                channel: channel ?? null,
                leadName: lead?.fullName ?? null,
                leadEmail: lead?.email ?? null,
                reason: a.reviewNote || a.reason || "This message needs your attention.",
                createdAt: a.createdAt,
            };
        });

        return NextResponse.json({ requests, needsAttention });
    } catch (error: any) {
        console.error("Failed to fetch approvals:", error);
        return NextResponse.json({ error: internalErrorMessage(error, "Internal Server Error") }, { status: 500 });
    }
}
