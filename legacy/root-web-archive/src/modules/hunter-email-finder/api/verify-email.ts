import { NextResponse } from "next/server";
import { hunterService } from "../service/hunterService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, leadId } = body;

        if (!email) {
            return NextResponse.json(
                { ok: false, error: "email is required" },
                { status: 400 }
            );
        }

        const result = await hunterService.verifyAndUpdateEmail(email, leadId);
        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
