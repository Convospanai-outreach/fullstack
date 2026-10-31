import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { createLandingFromTemplateSchema } from "../schemas";
import { landingAgentService } from "../service";

// POST /landing-agent/campaigns/from-template. The team comes from the session, never from the body.
export async function postCampaignFromTemplate(req: Request) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(ctx.userId, ctx.teamId, TeamRole.MEMBER);

        const body = await req.json();
        const parsed = createLandingFromTemplateSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const result = await landingAgentService.createCampaignFromTemplate({
            teamId: ctx.teamId,
            userId: ctx.userId,
            ...parsed.data,
        });
        return successResponse(result, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
