import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AuditService } from "@/modules/audit/auditService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();

        const body = await req.json();
        logger.info("[Extension Action] Received action result:", { teamId, userId, ...body });

        if (teamId && userId) {
            await AuditService.log(
                teamId,
                userId,
                "EXTENSION_ACTION",
                "Lead",
                body.leadId || body.profileUrl || null,
                body
            );
        }

        return NextResponse.json({ ok: true, message: "Action recorded" });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal error";
        logger.error("[Extension Action] Error processing result:", { error: errorMessage });
        return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
    }
}
