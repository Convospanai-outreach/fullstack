import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, createPostSchema, creatorContext, parseWhen } from "@/modules/creator-funnel/contentRoutes";

// Creator funnel content calendar: posts scheduled in [from, to) plus unscheduled drafts. The
// calendar filters in the browser so its stage-mix meter always sees the whole range.
const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;
const listQuery = z.object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;

        const query = listQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
        if (!query.success) return NextResponse.json({ error: "Invalid query", code: "VALIDATION_ERROR" }, { status: 400 });
        const from = new Date(query.data.from);
        const to = new Date(query.data.to);
        if (to <= from || to.getTime() - from.getTime() > MAX_RANGE_MS) {
            return NextResponse.json({ error: "Pick a range of up to 62 days", code: "VALIDATION_ERROR" }, { status: 400 });
        }

        const { listPosts } = await import("@/modules/creator-funnel/contentPostService");
        return NextResponse.json(await listPosts(ctx.teamId, from, to));
    } catch (error) {
        return contentError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;

        const parsed = await parseBody(req, createPostSchema);
        if (!parsed.ok) return parsed.response;

        const { createPost } = await import("@/modules/creator-funnel/contentPostService");
        const post = await createPost(ctx.teamId, ctx.userId, { ...parsed.data, scheduledAt: parseWhen(parsed.data.scheduledAt) ?? null });
        return NextResponse.json({ post }, { status: 201 });
    } catch (error) {
        return contentError(error);
    }
}
