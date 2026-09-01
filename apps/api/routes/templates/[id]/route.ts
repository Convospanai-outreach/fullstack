import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { z } from "zod";

const TemplateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Body is required"),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const body = await req.json();
        const validation = TemplateSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        // Verify ownership
        const existing = await prisma.emailTemplate.findUnique({
            where: { id, teamId }
        });

        if (!existing) {
            throw new APIError("Template not found", 404, "NOT_FOUND");
        }

        // Scoped by teamId here too, not just in the pre-check above - the mutation's
        // own safety must not depend solely on a separate pre-check holding true (same
        // anti-pattern already fixed under OPEN-99/109/110/118/120/121/122).
        await prisma.emailTemplate.updateMany({
            where: { id, teamId },
            data: validation.data
        });
        const template = await prisma.emailTemplate.findUnique({ where: { id, teamId } });

        return successResponse(template);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        // Verify ownership
        const existing = await prisma.emailTemplate.findUnique({
            where: { id, teamId }
        });

        if (!existing) {
            throw new APIError("Template not found", 404, "NOT_FOUND");
        }

        // Same reasoning as PUT above - scoped by teamId, not just the pre-check.
        await prisma.emailTemplate.deleteMany({
            where: { id, teamId }
        });

        return successResponse({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
