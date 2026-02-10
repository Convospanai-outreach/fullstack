import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
    }

    const body = await req.json();
    const { fromDate, toDate, format = "csv" } = body;

    try {
        const where: any = {};
        if (fromDate) where.createdAt = { ...where.createdAt, gte: new Date(fromDate) };
        if (toDate) where.createdAt = { ...where.createdAt, lte: new Date(toDate) };

        const errors = await prisma.clientError.findMany({
            where,
            orderBy: { createdAt: 'asc' }
        });

        if (format === "csv") {
            const csv = [
                "Timestamp,Message,URL,User ID,IP,User Agent",
                ...errors.map(e => {
                    const message = e.message.replace(/"/g, '""');
                    const url = e.url.replace(/"/g, '""');
                    const userAgent = e.userAgent.replace(/"/g, '""');
                    return `${e.createdAt.toISOString()},"${message}","${url}","${e.userId || 'N/A'}","${e.ip}","${userAgent}"`;
                })
            ].join("\n");

            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="client-errors-${Date.now()}.csv"`
                }
            });
        }

        return NextResponse.json({
            success: true,
            count: errors.length,
            errors
        });

    } catch (error: any) {
        console.error("[ClientErrors] Export failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
