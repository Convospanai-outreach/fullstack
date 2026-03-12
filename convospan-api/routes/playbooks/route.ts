import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { playbookService } from "@/modules/playbooks/playbookService";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const playbooks = await playbookService.listPlaybooks(ctx.teamId);
    return NextResponse.json(playbooks);
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        // MVP: Body contains direct config. 
        // Future: Provide 'campaignId' to clone FROM.
        const playbook = await playbookService.createPlaybook(ctx.teamId, body);
        return NextResponse.json(playbook);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
