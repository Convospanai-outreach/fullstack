import { NextResponse } from "next/server";
import { icpService } from "../service/icpService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const { icpId, leadData } = body;

        if (!icpId || !leadData) {
            return NextResponse.json(
                { ok: false, error: "icpId and leadData are required" },
                { status: 400 }
            );
        }

        const result = await icpService.scoreLead(teamId, icpId, leadData);
        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
