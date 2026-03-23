import { NextResponse } from "next/server";
import { aiService } from "../service/aiService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        const body = await req.json();
        const { lead, icp } = body;

        if (!lead) {
            return NextResponse.json({ ok: false, error: "Lead data required" }, { status: 400 });
        }

        const draft = await aiService.generateEmailDraft(lead, icp, teamId || undefined);
        return NextResponse.json({ ok: true, draft });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
