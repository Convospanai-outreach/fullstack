import { NextResponse } from "next/server";
import { hunterService } from "../service/hunterService";

export async function POST(req: Request) {
    try {
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
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
