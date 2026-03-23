import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { z } from "zod";

const BulkDeleteSchema = z.object({
    ids: z.array(z.string()).min(1, "No IDs provided"),
});

export async function DELETE(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const body = await req.json();
        const validation = BulkDeleteSchema.safeParse(body);

        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const { ids } = validation.data;

        // Verify all leads belong to the team
        const count = await prisma.lead.count({
            where: {
                id: { in: ids },
                teamId
            }
        });

        if (count !== ids.length) {
            throw new APIError("Some leads not found or unauthorized", 403, "FORBIDDEN");
        }

        await prisma.lead.deleteMany({
            where: {
                id: { in: ids }
            }
        });

        return successResponse({ success: true, count });
    } catch (error) {
        return handleAPIError(error);
    }
}
