import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { z } from "zod";

const WebhookSchema = z.object({
    url: z.string().url("Invalid URL"),
    events: z.array(z.string()).min(1, "Select at least one event"),
});

export async function GET(_req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        // Every other webhook-management route (settings/webhooks/*, webhooks/[id])
        // requires ADMIN; this was a second unguarded path to the same resource.
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const webhooks = await prisma.webhook.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" }
        });

        return successResponse(webhooks);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const body = await req.json();

        const validation = WebhookSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const { randomBytes } = await import('crypto');
        const webhook = await prisma.webhook.create({
            data: {
                ...validation.data,
                teamId,
                secret: randomBytes(32).toString('hex') // Strong secret for signature verification
            }
        });

        return successResponse(webhook, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
