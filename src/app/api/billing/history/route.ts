import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(_req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    try {
        const history = await billingService.getPaymentHistory(teamId);
        return NextResponse.json(history);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
