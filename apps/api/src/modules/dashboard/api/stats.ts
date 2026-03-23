import { NextResponse } from "next/server";
import { getDashboardStats } from "../service/dashboardService";

export async function GET() {
    try {
        const stats = await getDashboardStats();
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
