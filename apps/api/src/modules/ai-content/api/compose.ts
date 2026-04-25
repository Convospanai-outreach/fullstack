import { NextResponse } from "next/server";
import { aiService } from "../service/aiService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const { lead, icp } = body;

        if (!lead) {
            return NextResponse.json({ ok: false, error: "Lead data required" }, { status: 400 });
        }
        const serializedLead = JSON.stringify(lead);
        const serializedIcp = JSON.stringify(icp || {});
        if (serializedLead.length > 8000 || serializedIcp.length > 4000) {
            return NextResponse.json({ ok: false, error: "Input exceeds allowed size" }, { status: 400 });
        }

        const draft = await aiService.generateEmailDraft(lead, icp, teamId);
        return NextResponse.json({ ok: true, draft });
    } catch (err: any) {
        if (err?.message?.includes("Insufficient credits")) {
            return NextResponse.json(
                { ok: false, error: err.message },
                { status: 402 }
            );
        }
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
