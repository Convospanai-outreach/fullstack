import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { TeamRole } from "@/lib/permissions";
import { encryptCredential } from "@/lib/security/credentialVault";
import { requireTeamContext } from "./handlers";

// The team's Meta Conversions API token. Write-only: the token is encrypted before it is stored and no response
// ever returns it; a GET only says whether one is saved.

const putSchema = z.object({ accessToken: z.string().trim().min(20).max(2000) });

export async function getMetaCapiToken(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.ADMIN);
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { metaCapiTokenEnc: true } });
        return successResponse({ saved: Boolean(team?.metaCapiTokenEnc) });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function putMetaCapiToken(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.ADMIN);
        const body = await req.json().catch(() => null);
        const parsed = putSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Paste the access token from Meta Events Manager", 400, "VALIDATION_ERROR");
        }
        const encrypted = await encryptCredential(parsed.data.accessToken);
        await prisma.team.update({
            where: { id: teamId },
            data: { metaCapiTokenEnc: encrypted as unknown as Prisma.InputJsonValue },
        });
        return successResponse({ saved: true });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function deleteMetaCapiToken(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.ADMIN);
        await prisma.team.update({ where: { id: teamId }, data: { metaCapiTokenEnc: Prisma.DbNull } });
        return successResponse({ saved: false });
    } catch (error) {
        return handleAPIError(error);
    }
}
