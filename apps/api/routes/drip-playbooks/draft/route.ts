import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rateLimit";
import { internalErrorMessage } from "@/lib/internalError";
import { createDripDraft, DripInputError } from "@/modules/playbooks/dripDraft";

const DRAFTS_PER_DAY = 20;
const bodySchema = z.object({
    kind: z.string().trim().min(1).max(40),
    icpId: z.string().trim().min(1).max(100).optional(),
    assetUrl: z.string().trim().max(500).optional(),
    assetLabel: z.string().trim().max(60).optional(),
    bookingUrl: z.string().trim().max(500).optional(),
    timezone: z.string().trim().max(60).optional(),
});

// Writes a drip playbook's emails for this team and saves them as a draft. Nothing is enrolled or sent.
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const body = bodySchema.safeParse(await req.json().catch(() => null));
        if (!body.success) return NextResponse.json({ error: "Choose a playbook" }, { status: 400 });

        const limit = await checkRateLimit(ctx.teamId, { windowMs: 24 * 60 * 60 * 1000, maxRequests: DRAFTS_PER_DAY }, "drip-playbook-draft");
        if (!limit.allowed) return NextResponse.json({ error: "You have used today's playbook drafts. Try again tomorrow." }, { status: 429 });

        const { assetUrl, assetLabel, bookingUrl, ...rest } = body.data;
        const result = await createDripDraft({ ...rest, teamId: ctx.teamId, userId: ctx.userId, links: { assetUrl, assetLabel, bookingUrl } });
        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        if (err instanceof DripInputError) return NextResponse.json({ error: err.message }, { status: 400 });
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
