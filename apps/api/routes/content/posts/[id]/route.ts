import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext, parseWhen, updatePostSchema } from "@/modules/creator-funnel/contentRoutes";

// Edit or delete one calendar post. Editing the text, images or accounts of a post that is in
// review or approved sends it back to draft (see contentPostService.updatePost).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;

        const parsed = await parseBody(req, updatePostSchema);
        if (!parsed.ok) return parsed.response;

        const { id } = await params;
        const { scheduledAt, ...rest } = parsed.data;
        const { updatePost } = await import("@/modules/creator-funnel/contentPostService");
        const post = await updatePost(ctx.teamId, id, { ...rest, ...(scheduledAt !== undefined ? { scheduledAt: parseWhen(scheduledAt) ?? null } : {}) });
        return NextResponse.json({ post });
    } catch (error) {
        return contentError(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;

        const { id } = await params;
        const { deletePost } = await import("@/modules/creator-funnel/contentPostService");
        await deletePost(ctx.teamId, id);
        return NextResponse.json({ deleted: true });
    } catch (error) {
        return contentError(error);
    }
}
