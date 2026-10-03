import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

const MAX_ADJUSTMENT = 1_000_000;

// Grants (positive) or removes (negative) credits on a team, with a reason, as a
// CreditTransaction of type "admin_adjustment" next to the balance change.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const teamId = (await params).id;
    const input = (await req.json().catch(() => null)) as { amount?: unknown; reason?: unknown } | null;
    const amount = input?.amount;
    const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUSTMENT) {
        return NextResponse.json({ error: `amount must be a whole number between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}, not 0` }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

    const { prisma } = await import("@/lib/db");
    const result = await prisma.$transaction(async (tx) => {
        const team = await tx.team.findUnique({ where: { id: teamId }, select: { credits: true } });
        if (!team) return { ok: false, error: "Team not found", status: 404 } as const;
        if (team.credits + amount < 0) return { ok: false, error: `The team only has ${team.credits} credits.`, status: 400 } as const;
        const updated = await tx.team.update({ where: { id: teamId }, data: { credits: { increment: amount } }, select: { credits: true } });
        await tx.creditTransaction.create({
            data: {
                teamId,
                amount,
                type: "admin_adjustment",
                description: `Adjusted by the CraftMyFunnel team: ${reason}`,
                meta: { superAdminUserId: actor.id, reason },
            },
        });
        return { ok: true, credits: updated.credits, before: team.credits } as const;
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    await auditSuperAdmin(actor, "CREDITS_ADJUST", req, { teamId, amount, reason, before: result.before, after: result.credits });
    return NextResponse.json({ credits: result.credits });
}
