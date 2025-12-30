import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApprovalService } from "@/modules/governance/service/approvalService";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { action, reason } = await req.json(); // action: "APPROVE" | "REJECT"

    if (action === "APPROVE") {
      const result = await ApprovalService.approveRequest(params.id, session.user.id);
      return NextResponse.json({ success: true, result });
    } else if (action === "REJECT") {
      const result = await ApprovalService.rejectRequest(params.id, session.user.id, reason);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to process approval:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Error" }, { status: 500 });
  }
}
