import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const { id } = params;

        // Verify the user has permission (e.g., is owner or removing themselves)
        // For now, just check they are in the same team
        const memberToRemove = await prisma.teamMember.findUnique({
            where: { id }
        });

        if (!memberToRemove || memberToRemove.teamId !== teamId) {
            throw new APIError("Member not found or access denied", 403, "FORBIDDEN");
        }

        await prisma.teamMember.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
