import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const { userId } = await getCurrentContext();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const datasets = await prisma.trainingDataset.findMany({
        orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(datasets);
}
