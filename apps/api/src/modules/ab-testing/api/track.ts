import { NextResponse } from "next/server";
import { abService } from "../service/abService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { variant, type, leadId } = body;

        if (!variant || !type) {
            return NextResponse.json({ ok: false, error: "Variant and type required" }, { status: 400 });
        }

        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        if (leadId) {
            await abService.trackAssignment(ctx.teamId, leadId, variant);
        }
        await abService.trackConversion(ctx.teamId, variant, type);
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
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const stats = await abService.getStats(ctx.teamId);
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
