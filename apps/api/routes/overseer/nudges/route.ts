import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const nudges = await prisma.overseerNudge.findMany({
      where: { teamId: ctx.teamId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return NextResponse.json({ nudges });
  } catch (error) {
    console.error("Failed to fetch overseer nudges:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
