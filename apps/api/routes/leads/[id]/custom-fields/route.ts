import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { updateLeadCustomFields } from "@/modules/lead-properties/leadPropertyService";

// Saves a lead's property values. Body: { key: value | null } (null clears the key).
// Unknown keys, archived keys and wrong types are refused by the service.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new APIError("Send an object of property values", 400, "VALIDATION_ERROR");
        }

        const customFields = await updateLeadCustomFields(teamId, userId, id, body as Record<string, unknown>);
        return successResponse({ customFields });
    } catch (error) {
        return handleAPIError(error);
    }
}
