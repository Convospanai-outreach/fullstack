import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rateLimit";
import { internalErrorMessage } from "@/lib/internalError";
import { scanWebsite, ScanFailedError, ScanNotConfiguredError } from "@/modules/onboarding/service/websiteScan";

const SCANS_PER_DAY = 3;
const bodySchema = z.object({ url: z.string().trim().min(3).max(300) });

// Reads the customer's website and returns a draft profile. Saves nothing; the
// owner reviews and confirms in a later step.
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const body = bodySchema.safeParse(await req.json().catch(() => null));
        if (!body.success) return NextResponse.json({ error: "Enter your website address" }, { status: 400 });

        const limit = await checkRateLimit(ctx.teamId, { windowMs: 24 * 60 * 60 * 1000, maxRequests: SCANS_PER_DAY }, "setup-website-scan");
        if (!limit.allowed) {
            return NextResponse.json({ error: "You have used today's website scans. Try again tomorrow." }, { status: 429 });
        }

        const { profile, pagesRead } = await scanWebsite(body.data.url, ctx.teamId);
        return NextResponse.json({ ok: true, profile, pagesRead });
    } catch (err) {
        if (err instanceof ScanNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
        if (err instanceof ScanFailedError) return NextResponse.json({ error: err.message }, { status: 422 });
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
