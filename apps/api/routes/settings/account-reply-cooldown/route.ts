import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { accountReplyCooldownHours } from "@/lib/accountReplyCooldown";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";

const settingsSchema = z.object({ hours: z.union([z.literal(0), z.literal(24), z.literal(48), z.literal(72)]) });

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
        return NextResponse.json({ hours: accountReplyCooldownHours(team?.sendSafety), canEdit: await checkTeamPermission(userId, teamId, TeamRole.ADMIN) });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        const parsed = await parseBody(req, settingsSchema);
        if (!parsed.ok) return parsed.response;
        const { hours } = parsed.data;
        // Preserve other mail controls, including settings saved concurrently.
        await prisma.$executeRaw`
            UPDATE "Team" SET "sendSafety" = jsonb_set(
                CASE WHEN jsonb_typeof("sendSafety") = 'object' THEN "sendSafety" ELSE '{}'::jsonb END,
                '{accountReplyCooldownHours}', to_jsonb(${hours}::integer)
            ), "updatedAt" = now()
            WHERE "id" = ${teamId}`;
        return NextResponse.json({ hours });
    } catch (error) {
        return handleAPIError(error);
    }
}
