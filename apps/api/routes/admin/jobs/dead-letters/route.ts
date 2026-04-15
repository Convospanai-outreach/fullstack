import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
    try {
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where: { status: "dead_lettered" },
                orderBy: { completedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.job.count({ where: { status: "dead_lettered" } })
        ]);

        return successResponse({
            jobs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
