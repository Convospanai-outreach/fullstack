import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import {
    acceptPlacementResult,
    effectivePlacementVerdict,
    PlacementError,
    readPlacementState,
    requestPlacementCheck,
    withStuckCheckFailed,
    type PlacementState,
} from "@/modules/email-campaigner/service/inboxPlacementCheck";
import type { PlacementInboxResult } from "@/modules/email-campaigner/service/inboxPlacementVerdict";

const STATUS: Record<PlacementError["code"], number> = {
    MAILBOX_NOT_FOUND: 404, UNSUPPORTED_PROVIDER: 400, NO_TEST_INBOXES: 503, RATE_LIMITED: 429, CAMPAIGN_NOT_FOUND: 404, NOTHING_TO_ACCEPT: 409,
};

// Customers see the provider and folder of each test copy, never the operator's test addresses.
function publicView(state: PlacementState | null) {
    if (!state) return { state: null, verdict: effectivePlacementVerdict(null) };
    const results = (state.results as PlacementInboxResult[]).map(({ provider, folder, auth, error }) => ({ provider, folder, auth, error: error ?? null }));
    const { requestedBy: _requestedBy, sentTo, override, ...rest } = state;
    return { state: { ...rest, sent: sentTo?.length ?? 0, results, acceptedAt: override?.at ?? null }, verdict: effectivePlacementVerdict(state) };
}

async function context(params: Promise<{ id: string }>, role: TeamRole) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    await authorizeRole(userId, teamId, role);
    return { id, userId, teamId };
}

// The last inbox placement check for a mailbox and its green/amber/red verdict. Any team member may read it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id, teamId } = await context(params, TeamRole.VIEWER);
        const mailbox = await prisma.connectedMailbox.findFirst({ where: { id, teamId }, select: { metadata: true } });
        if (!mailbox) throw new APIError("Mailbox not found", 404, "MAILBOX_NOT_FOUND");
        return NextResponse.json(publicView(withStuckCheckFailed(readPlacementState(mailbox.metadata))));
    } catch (error) {
        return handleAPIError(error);
    }
}

const bodySchema = z.object({ campaignId: z.string().min(1).max(64).optional() }).strict();

// Starts a check: sends one copy of the campaign's first email to each test inbox. Admin only, because it sends
// real email and uses part of today's sending allowance. At most once an hour per mailbox.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id, userId, teamId } = await context(params, TeamRole.ADMIN);
        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) throw new APIError("Send an optional campaignId only.", 400, "INVALID_BODY");
        const state = await requestPlacementCheck({ teamId, mailboxId: id, userId, campaignId: parsed.data.campaignId ?? null });
        return NextResponse.json(publicView(state), { status: 202 });
    } catch (error) {
        if (error instanceof PlacementError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
        }
        return handleAPIError(error);
    }
}

const acceptSchema = z.object({ accept: z.literal(true) }).strict();

// An admin accepts a fresh red result (for example one test inbox misfiled a good email) so campaigns can start.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id, userId, teamId } = await context(params, TeamRole.ADMIN);
        const parsed = acceptSchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) throw new APIError("Send { accept: true }.", 400, "INVALID_BODY");
        const state = await acceptPlacementResult({ teamId, mailboxId: id, userId });
        return NextResponse.json(publicView(state));
    } catch (error) {
        if (error instanceof PlacementError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
        }
        return handleAPIError(error);
    }
}
