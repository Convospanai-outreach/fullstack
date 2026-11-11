import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { playbookService } from "@/modules/playbooks/playbookService";
import { internalErrorMessage } from "@/lib/internalError";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { values } = await req.json(); // { "companyName": "Acme", ... }
        const campaign = await playbookService.instantiatePlaybook(id, ctx.teamId, values || {});
        return NextResponse.json({ success: true, data: campaign });
    } catch (error: any) {
        return NextResponse.json({ error: internalErrorMessage(error) }, { status: 500 });
    }
}
