import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { judgeDraftFactors, JevUnavailableError } from "@/lib/ai/jev";
import { scoreDraft, scoreStrategiesIn } from "@/modules/email-campaigner/service/draftScores";
import { strategyIdsFromConfig } from "@/modules/overseer/strategyStall";

const bodySchema = z.object({
    subject: z.string().max(300).optional(),
    body: z.string().min(1).max(6000),
});

// Scores one draft against the conversion strategies (S7, S8, S12) the campaign follows. Runs only when
// someone asks for it, and only while JEV_DRAFT_SCORES=on, because each call is billed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (process.env["JEV_DRAFT_SCORES"] !== "on") {
            return NextResponse.json({ error: "Draft scoring isn't switched on yet.", code: "NOT_ENABLED" }, { status: 503 });
        }
        const { id } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const campaign = await prisma.campaign.findFirst({ where: { id, teamId }, select: { aiConfig: true } });
        if (!campaign) throw new APIError("Campaign not found", 404, "NOT_FOUND");

        // The campaign decides what is scored, not the request.
        const strategies = scoreStrategiesIn(strategyIdsFromConfig(campaign.aiConfig));
        if (strategies.length === 0) {
            return NextResponse.json({ error: "This campaign has no scoring strategy selected.", code: "NO_SCORING_STRATEGY" }, { status: 400 });
        }

        const parsed = await parseBody(req, bodySchema);
        if (!parsed.ok) return parsed.response;

        let factors;
        try {
            factors = await judgeDraftFactors(parsed.data, teamId);
        } catch (error) {
            if (error instanceof JevUnavailableError) {
                return NextResponse.json({ error: "Draft scoring isn't available right now.", code: "UNAVAILABLE" }, { status: 503 });
            }
            return NextResponse.json({ error: "The draft could not be scored just now. Try again in a moment.", code: "SCORING_FAILED" }, { status: 502 });
        }

        return NextResponse.json({ ok: true, scores: scoreDraft(factors, strategies) });
    } catch (error) {
        return handleAPIError(error);
    }
}
