import { NextResponse } from "next/server";
import { healthService } from "../service/healthService";

export async function GET() {
    try {
        const health = await healthService.getHealth();
        return NextResponse.json({ ok: true, health });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
