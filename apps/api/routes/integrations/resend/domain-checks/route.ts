import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { ensureResendDomainVerified } from "@/modules/email-campaigner/service/resendDomainService";
import { z } from "zod";

const DomainCheckSchema = z.object({
    domain: z.string().min(3).max(253),
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = DomainCheckSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const result = await ensureResendDomainVerified({
            teamId: ctx.teamId,
            domain: parsed.data.domain,
        });
        return NextResponse.json({ result });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to check this domain with Resend." }, { status: 500 });
    }
}
