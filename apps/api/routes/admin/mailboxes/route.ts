import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function GET() {
    try {
        const admin = await getAdminUser();
        if (!admin) throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");

        const memberships = await prisma.teamMember.findMany({
            where: { userId: admin.id },
            select: { teamId: true },
        });
        const teamIds = memberships.map((m) => m.teamId);
        const mailboxes = await (prisma as any).connectedMailbox.findMany({
            where: { teamId: { in: teamIds } },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                teamId: true,
                provider: true,
                emailAddress: true,
                scopes: true,
                gmailHistoryId: true,
                watchExpiration: true,
                status: true,
                lastSyncAt: true,
                lastError: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return NextResponse.json({ mailboxes });
    } catch (error: any) {
        return handleAPIError(error);
    }
}

