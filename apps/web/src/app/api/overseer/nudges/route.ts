import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const nudges = await prisma.overseerNudge.findMany({
      where: { teamId: ctx.teamId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return NextResponse.json({ nudges });
  } catch (error: any) {
    console.error("Failed to fetch overseer nudges:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
