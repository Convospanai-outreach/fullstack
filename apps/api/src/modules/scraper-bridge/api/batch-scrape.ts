import { NextResponse } from "next/server";
import { scraperService } from "../service/scraperService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requests } = body;

        if (!Array.isArray(requests)) {
            return NextResponse.json(
                { ok: false, error: "requests must be an array" },
                { status: 400 }
            );
        }

        const results = await scraperService.batchScrape(requests);
        return NextResponse.json({ ok: true, results });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
