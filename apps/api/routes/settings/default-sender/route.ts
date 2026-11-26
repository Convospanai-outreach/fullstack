import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { lockReputation, writeReputationAudit } from "@/modules/overseer/mailboxReputation";
import { setDefaultSender } from "@/modules/overseer/mailboxReputationActions";
import { jsonObject, mailboxSendingHold } from "@/modules/overseer/mailboxReputationHold";

const schema = z.object({ mailboxId: z.string().min(1).max(128).nullable() });

export async function GET(request: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(request);
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        if (!await checkTeamPermission(userId, teamId, TeamRole.VIEWER)) throw new APIError("Team access required", 403, "FORBIDDEN");
        const [team, mailboxes, canEdit] = await Promise.all([
            prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } }),
            prisma.connectedMailbox.findMany({ where: { teamId, status: "CONNECTED" }, select: { id: true, email: true, metadata: true } }),
            checkTeamPermission(userId, teamId, TeamRole.ADMIN),
        ]);
        const choices = mailboxes.filter((mailbox) => !mailboxSendingHold(mailbox.metadata)).map(({ id, email }) => ({ id, email }));
        const preferred = jsonObject(team?.sendSafety)["defaultSenderMailboxId"];
        return NextResponse.json({ mailboxId: choices.some(({ id }) => id === preferred) ? preferred : null, choices, canEdit });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(request);
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) throw new APIError("Admin access required", 403, "FORBIDDEN");
        const parsed = await parseBody(request, schema);
        if (!parsed.ok) return parsed.response;
        const { mailboxId } = parsed.data;
        await prisma.$transaction(async (tx) => {
            await lockReputation(tx, teamId);
            if (mailboxId) {
                const mailbox = await tx.connectedMailbox.findFirst({ where: { id: mailboxId, teamId, status: "CONNECTED" } });
                if (!mailbox || mailboxSendingHold(mailbox.metadata)) throw new APIError("Choose a connected mailbox without a sending hold", 409, "MAILBOX_UNAVAILABLE");
            }
            await setDefaultSender(tx, teamId, mailboxId);
            await writeReputationAudit(tx, teamId, mailboxId ?? teamId, "DEFAULT_SENDER_CHANGED", mailboxId ? "Selected team default sender" : "Cleared team default sender", userId);
        });
        return NextResponse.json({ mailboxId });
    } catch (error) {
        return handleAPIError(error);
    }
}
