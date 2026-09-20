import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

export async function POST(req: NextRequest) {
    // Cross-tenant client error export - SYSTEM_ADMIN only, same as the sibling
    // client-errors read route (S-05).
    const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
    if (!admin) {
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
