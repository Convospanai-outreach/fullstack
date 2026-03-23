import { NextResponse } from "next/server";
import { icpService } from "../service/icpService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const icp = await icpService.create(body);
        return NextResponse.json({ ok: true, icp });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
