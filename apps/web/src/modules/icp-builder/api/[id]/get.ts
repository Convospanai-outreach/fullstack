import { NextResponse } from "next/server";
import { icpService } from "../../service/icpService";

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const icp = await icpService.getById(params.id);
        if (!icp) {
            return NextResponse.json(
                { ok: false, error: "ICP not found" },
                { status: 404 }
            );
        }
        return NextResponse.json({ ok: true, icp });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
