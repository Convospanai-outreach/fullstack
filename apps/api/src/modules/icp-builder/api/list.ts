import { NextResponse } from "next/server";
import { icpService } from "../service/icpService";
import { getCurrentContextFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const { teamId } = await getCurrentContextFromRequest(req);
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const icps = await icpService.list(teamId, status ? { status } : {});
        return NextResponse.json({ ok: true, icps });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
