import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    // Publicly accessible? Or authenticated? Authenticated for now.
    // In future, might be public.

    const templates = await prisma.marketplaceTemplate.findMany({
        where: { isOfficial: true }, // Start with official only
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(templates);
}
