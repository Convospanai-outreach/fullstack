import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { prisma } = await import("@/lib/db");
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action } = await req.json(); // action: "ACTED" | "DISMISSED"
    if (action !== "ACTED" && action !== "DISMISSED") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await prisma.overseerNudge.updateMany({
      where: { id, teamId: ctx.teamId, status: "OPEN" },
      data: { status: action, actedAt: new Date() }
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update overseer nudge:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
