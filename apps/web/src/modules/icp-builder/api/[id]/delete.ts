import { NextResponse } from "next/server";
import { icpService } from "../../service/icpService";
import { getCurrentContext } from "@/lib/auth";

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const deleted = await icpService.delete(teamId, params.id);
        if (!deleted) {
            return NextResponse.json({ ok: false, error: "ICP not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
