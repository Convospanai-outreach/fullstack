import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const breaker = await prisma.breakerState.findUnique({ where: { teamId: ctx.teamId } });
    return NextResponse.json({ state: breaker?.state || "CLOSED", metrics: breaker?.metrics || null });
  } catch (error) {
    console.error("Failed to fetch breaker state:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
