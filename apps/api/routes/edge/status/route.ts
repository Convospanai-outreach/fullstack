import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getEdgeRuntimeAvailability } from "@/lib/edgeRuntime";

// Exposes the real on-prem edge runtime check (lib/edgeRuntime.ts) to the dashboard's
// Edge Runtime page, which previously only rendered hardcoded mock devices.
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const availability = await getEdgeRuntimeAvailability();
  return NextResponse.json({ success: true, data: availability });
}
