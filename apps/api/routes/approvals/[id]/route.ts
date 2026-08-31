import { NextRequest, NextResponse } from "next/server";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { getCurrentContextFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, reason } = await req.json(); // action: "APPROVE" | "REJECT"

    if (action === "APPROVE") {
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
