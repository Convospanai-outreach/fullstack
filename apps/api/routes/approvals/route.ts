import { NextRequest, NextResponse } from "next/server";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { getCurrentContextFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = await ApprovalService.getPendingRequests(ctx.teamId);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
