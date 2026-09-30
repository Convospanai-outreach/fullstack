import { NextRequest, NextResponse } from "next/server";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// Send a post for approval. It shows in Inbox > Approvals; nothing publishes until approved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;

        const { id } = await params;
        const { submitPost } = await import("@/modules/creator-funnel/contentPostService");
        return NextResponse.json(await submitPost(ctx.teamId, id, ctx.userId));
    } catch (error) {
        return contentError(error);
    }
}
