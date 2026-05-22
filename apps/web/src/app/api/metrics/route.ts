import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        return new NextResponse(await getMetrics(), {
            headers: {
                "Content-Type": "text/plain; version=0.0.4",
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
    }
}
