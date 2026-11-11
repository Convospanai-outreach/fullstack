import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { hunterService } from "../service/hunterService";
import { internalErrorMessage } from "@/lib/internalError";

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

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
            { ok: false, error: internalErrorMessage(err) },
            { status: 500 }
        );
    }
}
