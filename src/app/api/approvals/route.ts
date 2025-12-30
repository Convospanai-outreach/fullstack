import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApprovalService } from "@/modules/governance/service/approvalService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Determine teamId (assuming user has one for MVP context, or pass via query)
    const { searchParams } = new URL(req.url);
    let teamId = searchParams.get("teamId");

    if (!teamId) {
      // Fallback: Get first team for user
      const { prisma } = await import("@/lib/db");
      const member = await prisma.teamMember.findFirst({
        where: { userId: session.user.id }
      });
      if (member) teamId = member.teamId;
    }

    if (!teamId) return NextResponse.json({ error: "No team found for user" }, { status: 400 });

    const requests = await ApprovalService.getPendingRequests(teamId);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
