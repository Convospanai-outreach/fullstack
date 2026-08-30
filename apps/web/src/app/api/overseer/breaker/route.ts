import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const breaker = await prisma.breakerState.findUnique({ where: { teamId: ctx.teamId } });
    return NextResponse.json({ state: breaker?.state || "CLOSED", metrics: breaker?.metrics || null });
  } catch (error: any) {
    console.error("Failed to fetch breaker state:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
