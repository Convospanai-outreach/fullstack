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

export async function GET(_req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const templates = await prisma.emailTemplate.findMany({
            where: { teamId },
            orderBy: { updatedAt: "desc" }
        });

        return successResponse(templates);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const body = await req.json();

        const validation = TemplateSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const template = await prisma.emailTemplate.create({
            data: {
                ...validation.data,
                teamId
            }
        });

        return successResponse(template, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
