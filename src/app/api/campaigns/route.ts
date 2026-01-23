import { CampaignService } from "@/lib/campaignService";
import { createCampaignSchema } from "@/lib/validation/schemas";
import { SearchService } from "@/modules/search/service/SearchService";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        await authorizeRole(userId, teamId, TeamRole.VIEWER);

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;

        const campaigns = await SearchService.searchCampaigns(teamId, query, status);
        return successResponse(campaigns);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const body = await req.json();

        // Validate input
        const validation = createCampaignSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const campaign = await CampaignService.createCampaign({
            ...validation.data,
            teamId,
            // Ensure scheduledStart is passed if it exists (Zod returns string if datetime(), Service handles conversion)
            scheduledStart: validation.data.scheduledStart,
            type: validation.data.type
        } as any);
        return successResponse(campaign);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
