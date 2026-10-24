import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getDashboardStats } from "../service/dashboardService";
import { internalErrorMessage } from "@/lib/internalError";

export async function GET() {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const stats = await getDashboardStats(teamId);
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: internalErrorMessage(err) }, { status: 500 });
    }
}
