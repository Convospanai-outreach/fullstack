import { NextResponse } from "next/server";
import { icpService } from "../../service/icpService";
import { getCurrentContext } from "@/lib/auth";

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const icp = await icpService.update(teamId, params.id, body);
        if (!icp) {
            return NextResponse.json({ ok: false, error: "ICP not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true, icp });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
