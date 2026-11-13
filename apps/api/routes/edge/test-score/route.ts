import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getConfiguredEdgeRuntimeEndpoint } from "@/lib/edgeRuntime";

// Sends a fixed sample sentence (no lead data) to the node's /v1/score_intent so an admin can see it answer.
const SAMPLE_TEXT = "They asked for pricing and a demo this week.";

export async function POST() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const endpoint = getConfiguredEdgeRuntimeEndpoint();
    if (!endpoint) return NextResponse.json({ success: false, error: "Edge runtime is not configured." }, { status: 409 });

    const apiKey = process.env["EDGE_API_KEY"];
    const startedAt = Date.now();
    try {
        const res = await fetch(`${endpoint}/v1/score_intent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
            body: JSON.stringify({ text: SAMPLE_TEXT }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return NextResponse.json({ success: false, error: `Edge node answered HTTP ${res.status}.` }, { status: 502 });
        const body = (await res.json()) as { score?: unknown };
        if (typeof body.score !== "number") return NextResponse.json({ success: false, error: "Edge node returned no score." }, { status: 502 });
        return NextResponse.json({ success: true, data: { score: body.score, latencyMs: Date.now() - startedAt } });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || "Edge node unreachable." }, { status: 502 });
    }
}
