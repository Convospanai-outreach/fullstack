import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parseBody";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// The team's target share of posts per funnel stage, shown against the calendar's actual mix.
const pct = z.number().int().min(0).max(100);
const mixSchema = z
    .object({ TOFU: pct, MOFU: pct, BOFU: pct, POST: pct })
    .refine((m) => m.TOFU + m.MOFU + m.BOFU + m.POST === 100, "The four stages must add up to 100");

export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;
        const { getStageMix } = await import("@/modules/creator-funnel/contentPostService");
        return NextResponse.json({ target: await getStageMix(ctx.teamId) });
    } catch (error) {
        return contentError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;
        if (!(await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const parsed = await parseBody(req, mixSchema);
        if (!parsed.ok) return parsed.response;

        const { setStageMix } = await import("@/modules/creator-funnel/contentPostService");
        return NextResponse.json({ target: await setStageMix(ctx.teamId, parsed.data) });
    } catch (error) {
        return contentError(error);
    }
}
