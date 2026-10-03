import { NextResponse } from "next/server";
import { getSuperAdminActor } from "@/lib/superadmin/actor";

// Plans a superadmin can put a user on.
export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { prisma } = await import("@/lib/db");
    const plans = await prisma.plan.findMany({
        orderBy: { monthlyPrice: "asc" },
        select: { id: true, name: true, monthlyPrice: true, creditsPerMonth: true },
    });
    return NextResponse.json({ plans });
}
