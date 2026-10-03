import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

const MAX_DAYS = 3650;

// Puts a user on a plan without payment ({ planId, days }), or ends their plan
// ({ planId: null }). Stored with gateway "MANUAL". A subscription billed through
// Stripe is refused: changing it here would not change what Stripe charges.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const userId = (await params).id;
    const input = (await req.json().catch(() => null)) as { planId?: unknown; days?: unknown; reason?: unknown } | null;
    const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
    if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    if (input?.planId !== null && typeof input?.planId !== "string") {
        return NextResponse.json({ error: "planId must be a plan id or null" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/db");
    const [user, current] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
        prisma.subscription.findUnique({ where: { userId }, select: { planId: true, status: true, gateway: true, externalSubscriptionId: true } }),
    ]);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (current?.gateway === "STRIPE" && current.externalSubscriptionId && current.status !== "canceled") {
        return NextResponse.json({ error: "This plan is billed through Stripe. Change or cancel it in Stripe first." }, { status: 409 });
    }

    if (input.planId === null) {
        if (!current) return NextResponse.json({ error: "The user has no plan to end." }, { status: 400 });
        await prisma.subscription.update({ where: { userId }, data: { status: "canceled", currentPeriodEnd: new Date() } });
        await auditSuperAdmin(actor, "PLAN_END", req, { userId, reason, before: current });
        return NextResponse.json({ ok: true });
    }

    const days = input.days;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        return NextResponse.json({ error: `days must be a whole number from 1 to ${MAX_DAYS}` }, { status: 400 });
    }
    const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true, name: true } });
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await prisma.subscription.upsert({
        where: { userId },
        create: { userId, planId: plan.id, status: "active", currentPeriodEnd, gateway: "MANUAL" },
        update: { planId: plan.id, status: "active", currentPeriodEnd, gateway: "MANUAL", externalSubscriptionId: null },
    });
    await auditSuperAdmin(actor, "PLAN_SET", req, { userId, reason, plan: plan.name, days, before: current ?? null });
    return NextResponse.json({ ok: true, plan: plan.name, currentPeriodEnd: currentPeriodEnd.toISOString() });
}
