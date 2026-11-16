import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { loadLeadWorkflows } from "@/lib/leadWorkflowBatch";

const MAX_IDS = 100;

// GET /api/leads/workflow?ids=a,b,c - the six step states for each lead, for lead cards. Read-only.
export async function GET(req: Request) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean))];
    if (ids.length === 0) return NextResponse.json({ success: true, data: {} });
    if (ids.length > MAX_IDS) return NextResponse.json({ error: `At most ${MAX_IDS} leads per request` }, { status: 400 });

    const workflows = await loadLeadWorkflows(ctx.teamId, ids);
    const data = Object.fromEntries(
        [...workflows].map(([id, { steps }]) => [id, steps.map(({ key, label, state, detail }) => ({ key, label, state, detail }))])
    );
    return NextResponse.json({ success: true, data });
}
