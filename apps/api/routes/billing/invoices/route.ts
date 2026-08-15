import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    try {
        const invoices = await prisma.invoice.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                invoiceNumber: true,
                type: true,
                description: true,
                amount: true,
                currency: true,
                status: true,
                createdAt: true
            }
        });
        return NextResponse.json({ invoices });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
