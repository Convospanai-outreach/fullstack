import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const datasets = await prisma.trainingDataset.findMany({
        orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(datasets);
}
