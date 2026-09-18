import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { checkAdmin } from "@/lib/admin";

function rangeStart(range: string) {
    const now = new Date();
    const start = new Date(now);
    if (range === "7d") start.setDate(now.getDate() - 7);
    else if (range === "90d") start.setDate(now.getDate() - 90);
    else start.setDate(now.getDate() - 30);
    return start;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const isSuperAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
        if (!isSuperAdmin) {
            throw new APIError("Forbidden: Super admin access required", 403, "FORBIDDEN");
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const startDate = rangeStart(range);

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                enterpriseRole: true,
                credits: true,
                createdAt: true,
                updatedAt: true,
                memberships: {
                    select: {
                        teamId: true,
                        role: true,
                        status: true,
                        team: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!user) {
            throw new APIError("User not found", 404, "NOT_FOUND");
        }

        const [subscription, invoices, creditLedger, usageByProvider, usageByModel, auditLog] = await Promise.all([
            prisma.subscription.findUnique({
                where: { userId: id },
                select: {
                    status: true,
                    currentPeriodEnd: true,
                    gateway: true,
                    createdAt: true,
                    plan: { select: { name: true, monthlyPrice: true } },
                },
            }),
            prisma.invoice.findMany({
                where: { userId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    invoiceNumber: true,
                    type: true,
                    description: true,
                    amount: true,
                    currency: true,
                    gateway: true,
                    status: true,
                    createdAt: true,
                },
            }),
            prisma.creditLedger.findMany({
                where: { userId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: { id: true, amount: true, reason: true, createdAt: true },
            }),
            prisma.lLMUsageLog.groupBy({
                by: ["provider"],
                where: { actorId: id, createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _count: { _all: true },
            }),
            prisma.lLMUsageLog.groupBy({
                by: ["model"],
                where: { actorId: id, createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _count: { _all: true },
            }),
            prisma.auditLog.findMany({
                where: { actorId: id },
                orderBy: { createdAt: "desc" },
                take: 30,
                select: {
                    id: true,
                    action: true,
                    entity: true,
                    entityId: true,
                    createdAt: true,
                    team: { select: { name: true } },
                },
            }),
        ]);

        // "Dues" isn't a modeled concept - Invoice.status is only ever "paid" or
        // "refunded" (no failed/overdue state exists in this schema), so there's
        // no unpaid-amount to sum. The closest real signal is whether an active
        // subscription has drifted past its renewal date without a new period
        // starting - same lapse condition checkSubscription() uses elsewhere.
        const subscriptionPastDue = Boolean(
            subscription && subscription.status === "active" && subscription.currentPeriodEnd < new Date()
        );

        return NextResponse.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            enterpriseRole: user.enterpriseRole,
            credits: user.credits,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            teams: user.memberships.map((m) => ({ id: m.teamId, name: m.team.name, role: m.role, status: m.status })),
            subscription: subscription
                ? {
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    gateway: subscription.gateway,
                    createdAt: subscription.createdAt,
                    planName: subscription.plan?.name || "UNKNOWN",
                    monthlyPrice: subscription.plan?.monthlyPrice || 0,
                    pastDue: subscriptionPastDue,
                }
                : null,
            invoices,
            creditLedger,
            llmUsage: {
                range,
                byProvider: usageByProvider.map((p) => ({
                    provider: p.provider,
                    requests: p._count._all,
                    tokensIn: p._sum.tokensIn || 0,
                    tokensOut: p._sum.tokensOut || 0,
                    cost: p._sum.cost || 0,
                })),
                byModel: usageByModel.map((m) => ({
                    model: m.model,
                    requests: m._count._all,
                    tokensIn: m._sum.tokensIn || 0,
                    tokensOut: m._sum.tokensOut || 0,
                    cost: m._sum.cost || 0,
                })),
            },
            auditLog,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
