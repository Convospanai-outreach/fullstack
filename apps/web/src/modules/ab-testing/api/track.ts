import { NextResponse } from "next/server";
import { abService } from "../service/abService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { variant, type } = body;

        if (!variant || !type) {
            return NextResponse.json({ ok: false, error: "Variant and type required" }, { status: 400 });
        }

        await abService.trackConversion(variant, type);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const stats = await abService.getStats();
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
