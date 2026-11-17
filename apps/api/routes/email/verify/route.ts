import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { planEmailVerification, runEmailVerification } from "@/lib/emailStatusBatch";
import { lookupMx } from "@/modules/email-campaigner/service/dnsLookup";
import { verifyEmailWithHunter } from "@/integrations/hunter";

const BodySchema = z.object({
    leadIds: z.array(z.string().min(1)).min(1).max(500),
    // The number of paid provider checks the person agreed to. Without it nothing runs and nothing is spent.
    confirmProviderChecks: z.number().int().min(0).optional(),
});

const deps = { lookupMx, providerVerify: (email: string) => verifyEmailWithHunter(email) };

// Checks whether the leads' email addresses can be sent to. First call (no confirmation): returns how many
// provider checks the batch will use. Second call with that number: runs it. Never runs on import.
export async function POST(req: NextRequest) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN))) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });

    const leads = await prisma.lead.findMany({
        where: { id: { in: parsed.data.leadIds }, teamId: ctx.teamId },
        select: { id: true, email: true, emailStatus: true },
    });
    const plan = await planEmailVerification(leads, deps);

    if (parsed.data.confirmProviderChecks === undefined) return NextResponse.json({ plan });
    if (parsed.data.confirmProviderChecks !== plan.providerChecks) {
        return NextResponse.json({ error: "The number of provider checks changed. Review the new cost and confirm again.", plan }, { status: 409 });
    }

    const result = await runEmailVerification(leads, deps, async (leadId, r) => {
        await prisma.lead.update({
            where: { id: leadId },
            data: { emailStatus: r.status, emailStatusSource: r.source, emailStatusCheckedAt: new Date() },
        });
    });
    return NextResponse.json({ result });
}
