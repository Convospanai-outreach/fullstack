import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";
import { UserRole } from "@prisma/client";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";

// System admin only — replays a dead-lettered job by bare id with no team-ownership check.
export async function POST(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const isAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
        if (!isAdmin) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        // Fix: In Next.js 15+ route handlers, params is a Promise
        const { id } = await context.params;

        const job = await prisma.job.findUnique({
            where: { id }
        });

        if (!job) {
            throw new APIError("Job not found", 404, "NOT_FOUND");
        }

        if (job.status !== "dead_lettered") {
            throw new APIError("Only dead letter jobs can be replayed", 400, "BAD_REQUEST");
        }

        const updatedJob = await prisma.job.update({
            where: { id },
            data: {
                status: "queued",
                attempts: 0,
                error: null,
                processAt: new Date(),
                completedAt: null,
            }
        });

        return successResponse(updatedJob);
    } catch (error) {
        return handleAPIError(error);
    }
}
