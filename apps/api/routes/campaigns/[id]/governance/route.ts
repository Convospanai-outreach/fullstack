import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { buildGovernanceLog } from "@/lib/campaignGovernanceLog";
import { findCampaignApprovalIds } from "@/lib/campaignApprovals";

const MAX_ROWS = 200;
const person = { select: { name: true, email: true } };

// GET /api/campaigns/[id]/governance - who asked for what, who decided, and the outcome. Read-only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await hasPermission(ctx.userId, ctx.teamId, Permission.VIEW_AUDIT))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const campaign = await prisma.campaign.findFirst({ where: { id, teamId: ctx.teamId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Each approval makes up to two rows, so the newest MAX_ROWS approvals cover the newest MAX_ROWS rows.
    const approvalIds = await findCampaignApprovalIds(prisma, ctx.teamId, id, { limit: MAX_ROWS });
    const [approvals, audits] = await Promise.all([
        approvalIds.length === 0
            ? []
            : prisma.approvalRequest.findMany({
                  where: { teamId: ctx.teamId, id: { in: approvalIds } },
                  orderBy: { createdAt: "desc" },
                  select: {
                      id: true, actionType: true, entityType: true, entityId: true, status: true, payload: true,
                      createdAt: true, reviewedAt: true, updatedAt: true, requester: person, reviewer: person,
                  },
              }),
        prisma.auditLog.findMany({
            where: { orgId: ctx.teamId, entity: "Campaign", entityId: id },
            orderBy: { createdAt: "desc" },
            take: MAX_ROWS,
            select: { id: true, action: true, correlationId: true, metadata: true, createdAt: true, user: person },
        }),
    ]);

    // True when the log was cut at MAX_ROWS, so the page can say it shows the newest only.
    const capped = approvals.length >= MAX_ROWS || audits.length >= MAX_ROWS;

    return NextResponse.json({ success: true, data: { rows: buildGovernanceLog(approvals, audits, MAX_ROWS), capped } });
}
