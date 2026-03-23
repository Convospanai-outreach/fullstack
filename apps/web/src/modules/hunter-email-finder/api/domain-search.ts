import { NextResponse } from "next/server";
import { hunterClient } from "../service/hunterClient";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const domain = searchParams.get("domain");
        const limit = parseInt(searchParams.get("limit") || "10");

        if (!domain) {
            return NextResponse.json(
                { ok: false, error: "domain parameter is required" },
                { status: 400 }
            );
        }

        const result = await hunterClient.domainSearch(domain, limit);
        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
