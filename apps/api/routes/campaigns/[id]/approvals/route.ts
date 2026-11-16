import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { belongsToCampaign } from "@/lib/campaignApprovals";

const MAX_LEADS = 2000;
const MAX_PENDING = 500;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

// GET /api/campaigns/[id]/approvals - what is waiting for a manager's decision on this campaign.
// Read-only: deciding goes through the existing approvals endpoint, which enforces who may decide.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaign = await prisma.campaign.findFirst({ where: { id, teamId: ctx.teamId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const [leads, pending, canDecide] = await Promise.all([
        prisma.lead.findMany({
            where: { campaignId: id, teamId: ctx.teamId },
            orderBy: { createdAt: "desc" },
            take: MAX_LEADS,
            select: { id: true },
        }),
        prisma.approvalRequest.findMany({
            where: { teamId: ctx.teamId, status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: MAX_PENDING,
            select: {
                id: true, actionType: true, entityType: true, entityId: true, tier: true, reason: true, payload: true,
                autoDenyAt: true, createdAt: true, requester: { select: { name: true, email: true } },
            },
        }),
        hasPermission(ctx.userId, ctx.teamId, Permission.RESOLVE_APPROVALS),
    ]);

    const leadIds = new Set(leads.map((l) => l.id));
    const requests = pending
        .filter((a) => belongsToCampaign(a, id, leadIds))
        .map((a) => {
            const payload = a.payload && typeof a.payload === "object" && !Array.isArray(a.payload) ? (a.payload as Record<string, unknown>) : {};
            return {
                requestId: a.id,
                actionType: a.actionType,
                tier: a.tier,
                reason: a.reason,
                requestedBy: a.requester?.name || a.requester?.email || null,
                createdAt: a.createdAt.toISOString(),
                expiresAt: a.autoDenyAt ? a.autoDenyAt.toISOString() : null,
                // The draft a reviewer is being asked to approve, exactly as the Approvals page shows it.
                draft: { subject: text(payload["subject"]), body: text(payload["body"]) },
            };
        });

    // True when a cap may have hidden older requests, so the gate can say it shows the newest only.
    const capped = leads.length >= MAX_LEADS || pending.length >= MAX_PENDING;

    return NextResponse.json({ success: true, data: { canDecide, requests, capped } });
}
