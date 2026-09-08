import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        // Every other webhook-management route (settings/webhooks/*) requires ADMIN;
        // this one is a second, unguarded path to the same resource.
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        // Verify ownership
        const existing = await prisma.webhook.findUnique({
            where: { id, teamId }
        });

        if (!existing) {
            throw new APIError("Webhook not found", 404, "NOT_FOUND");
        }

        // Scoped by teamId here too, not just via the pre-check above - the
        // mutation's own safety must not depend solely on a separate
        // pre-check holding true (see OPEN-99/109/110/118/120/121/122/123/
        // 127/128/150/166/227 for the same anti-pattern).
        await prisma.webhook.delete({
            where: { id, teamId }
        });

        return successResponse({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
