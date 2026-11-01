import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { archiveLeadProperty, renameLeadProperty } from "@/modules/lead-properties/leadPropertyService";

// Only the label can change: key and type are fixed once created, so stored values keep their meaning.
// Delete hides the property (archivedAt); the values on leads are kept.

const renameSchema = z.object({ label: z.string().max(200) });

async function adminContext() {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    await authorizeRole(userId, teamId, TeamRole.ADMIN);
    return { teamId, userId };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, userId } = await adminContext();
        const parsed = await parseBody(req, renameSchema);
        if (!parsed.ok) return parsed.response;

        await renameLeadProperty(teamId, userId, id, parsed.data.label);
        return successResponse({ id, label: parsed.data.label.trim() });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, userId } = await adminContext();

        await archiveLeadProperty(teamId, userId, id);
        return successResponse({ id, archived: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
