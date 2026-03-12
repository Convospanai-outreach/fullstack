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

        const template = await prisma.emailTemplate.update({
            where: { id },
            data: validation.data
        });

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

        await prisma.emailTemplate.delete({
            where: { id }
        });

        return successResponse({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
