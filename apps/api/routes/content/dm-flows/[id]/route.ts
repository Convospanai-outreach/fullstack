import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// One DM flow: read, edit (name and/or steps; each edit bumps the version) or archive. DELETE
// archives rather than deleting, because runs keep the flow they started with.
const updateDmFlowSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    steps: z.array(z.unknown()).max(12).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "read");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { getDmFlow } = await import("@/modules/creator-funnel/dmFlowService");
        return NextResponse.json({ flow: await getDmFlow(ctx.teamId, id) });
    } catch (error) {
        return contentError(error);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const parsed = await parseBody(req, updateDmFlowSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { updateDmFlow } = await import("@/modules/creator-funnel/dmFlowService");
        return NextResponse.json({ flow: await updateDmFlow(ctx.teamId, ctx.userId, id, parsed.data) });
    } catch (error) {
        return contentError(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { archiveDmFlow } = await import("@/modules/creator-funnel/dmFlowService");
        await archiveDmFlow(ctx.teamId, ctx.userId, id);
        return NextResponse.json({ archived: true });
    } catch (error) {
        return contentError(error);
    }
}
