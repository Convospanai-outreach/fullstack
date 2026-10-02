import { NextRequest, NextResponse } from "next/server";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// Write a failed (or stuck) playbook wizard plan again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { retryRun } = await import("@/modules/creator-funnel/playbookWizard");
        await retryRun(ctx.teamId, id);
        return NextResponse.json({ ok: true }, { status: 202 });
    } catch (error) {
        return contentError(error);
    }
}
