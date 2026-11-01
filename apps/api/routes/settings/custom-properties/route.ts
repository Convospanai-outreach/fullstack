import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { createLeadProperty, listLeadProperties } from "@/modules/lead-properties/leadPropertyService";

// Custom lead properties: list for any team member, create for admins. Rules live in leadProperties.ts.

const createSchema = z.object({
    key: z.string().max(64),
    label: z.string().max(200),
    type: z.string().max(20),
    options: z.array(z.string().max(200)).max(50).optional(),
});

export async function GET() {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const properties = await listLeadProperties(teamId);
        return successResponse({ properties });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(req: Request) {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const parsed = await parseBody(req, createSchema);
        if (!parsed.ok) return parsed.response;

        const created = await createLeadProperty(teamId, userId, parsed.data);
        return successResponse(created, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
