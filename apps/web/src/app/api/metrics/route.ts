import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const metrics = await getMetrics();
        return new NextResponse(metrics, {
            headers: {
                "Content-Type": "text/plain; version=0.0.4",
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
    }
}

