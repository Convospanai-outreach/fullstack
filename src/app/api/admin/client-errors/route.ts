import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    // Verify admin access
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.enterpriseRole || '')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const limit = parseInt(params.get("limit") || "50");
    const url = params.get("url");
    const userId = params.get("userId");
    const fromDate = params.get("fromDate");
    const toDate = params.get("toDate");

    try {
        const where: any = {};

        if (url) where.url = { contains: url };
        if (userId) where.userId = userId;
        if (fromDate) where.createdAt = { ...where.createdAt, gte: new Date(fromDate) };
        if (toDate) where.createdAt = { ...where.createdAt, lte: new Date(toDate) };

        const errors = await prisma.clientError.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        return NextResponse.json({
            success: true,
            count: errors.length,
            errors
        });

    } catch (error: any) {
        console.error("[ClientErrors] Query failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
