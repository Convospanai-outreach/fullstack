import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { buildGovernanceLog } from "@/lib/campaignGovernanceLog";
import { belongsToCampaign } from "@/lib/campaignApprovals";

const MAX_ROWS = 200;
const MAX_LEADS = 2000;
// Approvals are matched to the campaign in code (see belongsToCampaign), over the team's newest requests.
const MAX_TEAM_APPROVALS = 2000;
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

    const leads = await prisma.lead.findMany({
        where: { campaignId: id, teamId: ctx.teamId },
        orderBy: { createdAt: "desc" },
        take: MAX_LEADS,
        select: { id: true },
    });

    const [approvals, audits] = await Promise.all([
        prisma.approvalRequest.findMany({
            where: { teamId: ctx.teamId },
            orderBy: { createdAt: "desc" },
            take: MAX_TEAM_APPROVALS,
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

    const leadIds = new Set(leads.map((l) => l.id));
    const campaignApprovals = approvals.filter((a) => belongsToCampaign(a, id, leadIds));

    // True when a cap may have hidden older entries, so the page can say the log shows the newest only.
    const capped = leads.length >= MAX_LEADS || approvals.length >= MAX_TEAM_APPROVALS;

    return NextResponse.json({ success: true, data: { rows: buildGovernanceLog(campaignApprovals, audits, MAX_ROWS), capped } });
}
