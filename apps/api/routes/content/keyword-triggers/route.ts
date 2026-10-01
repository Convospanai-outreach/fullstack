import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";
import { createTriggerSchema } from "@/modules/creator-funnel/keywordTriggerService";

// Keyword auto-replies: list (with what the editor needs) and create. New ones start switched off.
export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "read");
        if (ctx instanceof NextResponse) return ctx;
        const { listTriggers } = await import("@/modules/creator-funnel/keywordTriggerService");
        return NextResponse.json(await listTriggers(ctx.teamId));
    } catch (error) {
        return contentError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const parsed = await parseBody(req, createTriggerSchema);
        if (!parsed.ok) return parsed.response;
        const { createTrigger } = await import("@/modules/creator-funnel/keywordTriggerService");
        return NextResponse.json({ trigger: await createTrigger(ctx.teamId, ctx.userId, parsed.data) }, { status: 201 });
    } catch (error) {
        return contentError(error);
    }
}
