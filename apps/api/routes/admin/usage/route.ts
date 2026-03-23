import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { UserRole } from "@prisma/client";

const isAdminUser = (user: { role?: string | null; enterpriseRole?: UserRole | null } | null) => {
    if (!user) return false;
    const legacyAdmin = user.role === "admin" || user.role === "superadmin";
    const enterpriseAdmin =
        user.enterpriseRole === UserRole.SYSTEM_ADMIN ||
        user.enterpriseRole === UserRole.ORG_ADMIN;
    return legacyAdmin || enterpriseAdmin;
};

export async function GET(req: Request) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, enterpriseRole: true }
        });
        if (!isAdminUser(currentUser)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const now = new Date();
        const startDate = new Date(now);
        if (range === "7d") startDate.setDate(now.getDate() - 7);
        if (range === "30d") startDate.setDate(now.getDate() - 30);
        if (range === "90d") startDate.setDate(now.getDate() - 90);

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                enterpriseRole: true,
                createdAt: true,
                credits: true,
                memberships: {
                    select: {
                        teamId: true,
                        role: true,
                        team: {
                            select: {
                                id: true,
                                name: true,
                                credits: true
                            }
                        }
                    }
                }
            }
        });

        const userIds = users.map((u) => u.id);
        const teamIds = Array.from(
            new Set(
                users.flatMap((u) => u.memberships.map((m) => m.teamId)).filter(Boolean)
            )
        );

        const creditLedger = await prisma.creditLedger.findMany({
            where: {
                userId: { in: userIds },
                createdAt: { gte: startDate }
            },
            select: { userId: true, amount: true }
        });

        const creditTransactions = await prisma.creditTransaction.groupBy({
            by: ["teamId", "type"],
            where: {
                teamId: { in: teamIds },
                createdAt: { gte: startDate }
            },
            _sum: { amount: true }
        });

        const usageLogs = await prisma.lLMUsageLog.groupBy({
            by: ["teamId"],
            where: {
                teamId: { in: teamIds },
                createdAt: { gte: startDate }
            },
            _sum: { tokensIn: true, tokensOut: true, cost: true }
        });

        const ledgerByUser = new Map<string, { net: number; spent: number }>();
        for (const entry of creditLedger) {
            const current = ledgerByUser.get(entry.userId) || { net: 0, spent: 0 };
            current.net += entry.amount;
            if (entry.amount < 0) current.spent += Math.abs(entry.amount);
            ledgerByUser.set(entry.userId, current);
        }

        const usageByTeam = new Map<string, { tokensIn: number; tokensOut: number; cost: number }>();
        for (const entry of usageLogs) {
            usageByTeam.set(entry.teamId, {
                tokensIn: entry._sum.tokensIn || 0,
                tokensOut: entry._sum.tokensOut || 0,
                cost: entry._sum.cost || 0
            });
        }

        const creditsByTeam = new Map<
            string,
            { spent: number; topup: number; bonus: number }
        >();
        for (const entry of creditTransactions) {
            const current = creditsByTeam.get(entry.teamId) || { spent: 0, topup: 0, bonus: 0 };
            const amount = entry._sum.amount || 0;
            if (entry.type === "usage") current.spent += Math.abs(amount);
            if (entry.type === "topup") current.topup += amount;
            if (entry.type === "bonus") current.bonus += amount;
            creditsByTeam.set(entry.teamId, current);
        }

        const teams = Array.from(
            new Map(
                users
                    .flatMap((u) => u.memberships.map((m) => m.team))
                    .filter(Boolean)
                    .map((t) => [t.id, t])
            ).values()
        ).map((team) => {
            const usage = usageByTeam.get(team.id) || { tokensIn: 0, tokensOut: 0, cost: 0 };
            const credits = creditsByTeam.get(team.id) || { spent: 0, topup: 0, bonus: 0 };
            return {
                id: team.id,
                name: team.name,
                credits: team.credits,
                tokensIn: usage.tokensIn,
                tokensOut: usage.tokensOut,
                cost: usage.cost,
                creditsSpent: credits.spent,
                creditsTopup: credits.topup,
                creditsBonus: credits.bonus
            };
        });

        const usersWithUsage = users.map((user) => {
            const primaryMembership = user.memberships[0];
            const team = primaryMembership?.team || null;
            const usage = team ? usageByTeam.get(team.id) : undefined;
            const ledger = ledgerByUser.get(user.id);

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                enterpriseRole: user.enterpriseRole,
                createdAt: user.createdAt,
                credits: user.credits,
                team: team ? { id: team.id, name: team.name, role: primaryMembership?.role } : null,
                creditsNet: ledger?.net || 0,
                creditsSpent: ledger?.spent || 0,
                tokensIn: usage?.tokensIn || 0,
                tokensOut: usage?.tokensOut || 0,
                tokenCost: usage?.cost || 0
            };
        });

        const totals = teams.reduce(
            (acc, team) => {
                acc.tokensIn += team.tokensIn;
                acc.tokensOut += team.tokensOut;
                acc.cost += team.cost;
                acc.creditsSpent += team.creditsSpent;
                return acc;
            },
            { tokensIn: 0, tokensOut: 0, cost: 0, creditsSpent: 0 }
        );

        return NextResponse.json({
            range,
            totals,
            users: usersWithUsage,
            teams
        });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
