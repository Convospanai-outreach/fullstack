import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { analyzeLeadJourney } from "@/services/leadJourneySuggestionService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const result = await analyzeLeadJourney({ teamId, leadId: id });
        return NextResponse.json({
            ...result,
            mode: "advisory_only",
            message: "Suggestions are advisory. No lead status was changed.",
        });
    } catch (error: any) {
        if (error?.statusCode === 404) {
            return NextResponse.json({ error: "Lead not found", code: "NOT_FOUND" }, { status: 404 });
        }
        return handleAPIError(error);
    }
}
