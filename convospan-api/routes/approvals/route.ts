import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "No team found for user" }, { status: 400 });

    const requests = await ApprovalService.getPendingRequests(ctx.teamId);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
