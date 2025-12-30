import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { z } from "zod";

const MeetingSchema = z.object({
    title: z.string().min(1, "Title is required"),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    leadId: z.string().optional(),
    notes: z.string().optional(),
});

export async function GET(_req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const meetings = await prisma.meeting.findMany({
            where: { teamId },
            include: { lead: { select: { fullName: true } } },
            orderBy: { startTime: "asc" }
        });

        return successResponse(meetings);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(_req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const body = await _req.json();
        const validation = MeetingSchema.safeParse(body);

        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const { title, startTime, endTime, leadId, notes } = validation.data;

        const meeting = await prisma.meeting.create({
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                leadId: leadId ?? null,
                notes: notes ?? null,
                teamId
            }
        });

        return successResponse(meeting);
    } catch (error) {
        return handleAPIError(error);
    }
}
