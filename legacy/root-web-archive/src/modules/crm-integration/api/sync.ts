import { NextResponse } from "next/server";
import { crmService } from "../service/crmService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { lead } = body;

        if (!lead) {
            return NextResponse.json({ ok: false, error: "Lead data required" }, { status: 400 });
        }

        const result = await crmService.syncLead(lead.id, lead.teamId);
        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
