import { NextRequest, NextResponse } from "next/server";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, Permission } from "@/lib/permissions";
import { isBlockedSelfApproval } from "@/lib/governance/campaignStartApproval";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Same bar as the web approvals route: deciding a request needs RESOLVE_APPROVALS (owner or admin).
    if (!(await hasPermission(ctx.userId, ctx.teamId, Permission.RESOLVE_APPROVALS))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { action, reason } = await req.json(); // action: "APPROVE" | "REJECT"

    if (action === "APPROVE") {
      const approval = await prisma.approvalRequest.findFirst({
        where: { id, teamId: ctx.teamId },
        select: { teamId: true, actionType: true, requesterId: true },
      });
      if (approval && await isBlockedSelfApproval(approval, ctx.userId)) {
        return NextResponse.json({ error: "Someone else on your team needs to approve a campaign start you requested." }, { status: 403 });
      }
      const result = await ApprovalService.approve(id, ctx.userId, ctx.teamId);
      return NextResponse.json({ success: true, result });
    } else if (action === "REJECT") {
      const result = await ApprovalService.reject(id, ctx.userId, ctx.teamId, reason);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to process approval:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Error" }, { status: 500 });
  }
}
