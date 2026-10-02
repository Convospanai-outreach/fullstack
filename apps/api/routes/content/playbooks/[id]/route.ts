import { NextRequest, NextResponse } from "next/server";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// One playbook wizard plan: everything it drafted, for review; DELETE removes the plan and its
// drafts (posts already live are kept).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { getRun } = await import("@/modules/creator-funnel/playbookWizard");
        return NextResponse.json({ run: await getRun(ctx.teamId, id) });
    } catch (error) {
        return contentError(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { deleteRun } = await import("@/modules/creator-funnel/playbookWizard");
        return NextResponse.json(await deleteRun(ctx.teamId, id));
    } catch (error) {
        return contentError(error);
    }
}
