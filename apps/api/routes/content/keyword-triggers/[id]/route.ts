import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";
import { updateTriggerSchema } from "@/modules/creator-funnel/keywordTriggerService";

// Edit, switch on/off (`active`) or delete one keyword auto-reply.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const parsed = await parseBody(req, updateTriggerSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { updateTrigger } = await import("@/modules/creator-funnel/keywordTriggerService");
        return NextResponse.json({ trigger: await updateTrigger(ctx.teamId, ctx.userId, id, parsed.data) });
    } catch (error) {
        return contentError(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { deleteTrigger } = await import("@/modules/creator-funnel/keywordTriggerService");
        await deleteTrigger(ctx.teamId, id);
        return NextResponse.json({ deleted: true });
    } catch (error) {
        return contentError(error);
    }
}
