import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

// Disconnect: wipe the stored token and mark the account DISCONNECTED (reconnecting through
// the OAuth flow restores it). Admin only, same as connecting.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await checkTeamPermission(userId, teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { isCreatorFunnelEnabled } = await import("@/modules/creator-funnel/featureGate");
        if (!(await isCreatorFunnelEnabled(teamId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const { id } = await params;
        const { prisma } = await import("@/lib/db");
        const result = await prisma.socialAccount.updateMany({
            where: { id, teamId },
            data: { status: "DISCONNECTED", encryptedToken: Prisma.DbNull, lastError: null, expiryWarnedAt: null },
        });
        if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ disconnected: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
