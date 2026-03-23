import { NextResponse } from "next/server";
import { icpService } from "../../service/icpService";

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const icp = await icpService.update(params.id, body);
        return NextResponse.json({ ok: true, icp });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
