import { NextResponse } from "next/server";
import { vectorStore } from "../service/vectorStore";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, limit } = body;

        if (!query) {
            return NextResponse.json(
                { ok: false, error: "query is required" },
                { status: 400 }
            );
        }

        const results = await vectorStore.search(query, limit);
        return NextResponse.json({ ok: true, results });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
