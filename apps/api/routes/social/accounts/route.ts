import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

// Creator funnel: the team's connected social accounts (Settings > Social accounts).
// Tokens never leave the server. Connecting happens through the web app's Meta OAuth flow.
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { isCreatorFunnelEnabled } = await import("@/modules/creator-funnel/featureGate");
        if (!(await isCreatorFunnelEnabled(teamId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const { prisma } = await import("@/lib/db");
        const accounts = await prisma.socialAccount.findMany({
            where: { teamId, status: { not: "DISCONNECTED" } },
            orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
            select: {
                id: true,
                platform: true,
                externalId: true,
                handle: true,
                parentExternalId: true,
                scopes: true,
                status: true,
                lastError: true,
                tokenExpiresAt: true,
                createdAt: true,
            },
        });
        return NextResponse.json({ accounts });
    } catch (error) {
        return handleAPIError(error);
    }
}
