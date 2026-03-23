import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

// GET: Get current user profile
export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) throw new APIError("User not found", 404, "NOT_FOUND");

        // Fetch team credits if available
        let credits = 0;
        if (teamId) {
            const team = await prisma.team.findUnique({
                where: { id: teamId },
                select: { credits: true }
            }) as any;
            credits = team?.credits || 0;
        }

        return NextResponse.json({ ...user, credits });
    } catch (error: any) {
        return handleAPIError(error);
    }
}

// PUT: Update user profile
export async function PUT(req: Request) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const body = await req.json();
        const { name, image, address } = body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                image,
                address
            }
        });

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
