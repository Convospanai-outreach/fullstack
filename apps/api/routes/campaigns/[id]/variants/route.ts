import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { z } from "zod";

const VariantSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Body is required"),
    weight: z.number().min(0).max(100).default(50),
});

const VariantsArraySchema = z.array(VariantSchema);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const { id: campaignId } = await params;
        const body = await req.json();

        // Validate input
        const validation = VariantsArraySchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        // Verify campaign ownership
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId }
        });

        if (!campaign) {
            throw new APIError("Campaign not found", 404, "NOT_FOUND");
        }

        // Delete existing variants (simple replacement strategy)
        await prisma.campaignVariant.deleteMany({
            where: { campaignId }
        });

        // Create new variants
        const variants = await Promise.all(
            validation.data.map(v =>
                prisma.campaignVariant.create({
                    data: {
                        campaignId,
                        subject: v.subject,
                        body: v.body,
                        weight: v.weight
                    }
                })
            )
        );

        return successResponse(variants, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        const { id: campaignId } = await params;

        const variants = await prisma.campaignVariant.findMany({
            where: { campaignId, campaign: { teamId } }
        });

        return successResponse(variants);
    } catch (error) {
        return handleAPIError(error);
    }
}
