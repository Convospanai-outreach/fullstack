import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Require ADMIN+ for billing details
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const [balance, history] = await Promise.all([
            billingService.getTeamCredits(teamId),
            billingService.getPaymentHistory(teamId)
        ]);

        return NextResponse.json({
            balance,
            history
        });
    } catch (error: any) {
        console.error("Error fetching usage stats:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
