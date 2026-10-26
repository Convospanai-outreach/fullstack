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
        const { firstName, lastName, domain, leadId } = body;

        if (!firstName || !lastName || !domain) {
            return NextResponse.json(
                { ok: false, error: "firstName, lastName, and domain are required" },
                { status: 400 }
            );
        }

        const result = await hunterService.findAndStoreEmail({
            firstName,
            lastName,
            domain,
            leadId,
        });

        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: internalErrorMessage(err) },
            { status: 500 }
        );
    }
}
