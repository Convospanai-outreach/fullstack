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

function latestDate(values: Array<Date | null | undefined>) {
    const times = values.filter(Boolean).map((value) => value!.getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
}

export async function GET(req: Request) {
    try {
        const isSuperAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
        if (!isSuperAdmin) {
            throw new APIError("Forbidden: Super admin access required", 403, "FORBIDDEN");
        }

        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const startDate = rangeStart(range);

        const [
            users,
            teams,
            apiKeys,
            usageByTeam,
            usageByProvider,
            usageByModel,
            creditTransactions,
            auditCount,
            systemEventCount,
            recentAudit,
            recentSystemEvents,
        ] = await Promise.all([
            prisma.user.findMany({
                orderBy: { createdAt: "desc" },
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
                    creditLedger: {
                        where: { createdAt: { gte: startDate } },
                        select: { amount: true, createdAt: true },
                    },
                },
            }),
            prisma.team.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    credits: true,
                    createdAt: true,
                    members: { select: { id: true } },
                    leads: { select: { id: true } },
                    campaigns: { select: { id: true } },
                    apiKeys: {
                        select: {
                            id: true,
                            name: true,
                            scopes: true,
                            isActive: true,
                            lastUsedAt: true,
                            createdAt: true,
                        },
                    },
                },
            }),
            prisma.apiKey.findMany({
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                    id: true,
                    name: true,
                    scopes: true,
                    isActive: true,
                    lastUsedAt: true,
                    createdAt: true,
                    teamId: true,
                    team: { select: { name: true } },
                },
            }),
            prisma.lLMUsageLog.groupBy({
                by: ["teamId"],
                where: { createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _count: { _all: true },
                _avg: { latency: true },
            }),
            prisma.lLMUsageLog.groupBy({
                by: ["provider"],
                where: { createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _count: { provider: true },
            }),
            prisma.lLMUsageLog.groupBy({
                by: ["model"],
                where: { createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _count: { model: true },
            }),
            prisma.creditTransaction.groupBy({
                by: ["teamId", "type"],
                where: { createdAt: { gte: startDate } },
                _sum: { amount: true },
            }),
            prisma.auditLog.count({ where: { createdAt: { gte: startDate } } }),
            prisma.systemEvent.count({ where: { timestamp: { gte: startDate } } }),
            prisma.auditLog.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    action: true,
                    entity: true,
                    entityId: true,
                    createdAt: true,
                    user: { select: { email: true, enterpriseRole: true } },
                    team: { select: { name: true } },
                },
            }),
            prisma.systemEvent.findMany({
                orderBy: { timestamp: "desc" },
                take: 10,
                select: {
                    id: true,
                    type: true,
                    name: true,
                    teamId: true,
                    timestamp: true,
                },
            }),
        ]);

        const usageMap = new Map(usageByTeam.map((usage) => [usage.teamId, {
            requests: usage._count._all || 0,
            tokensIn: usage._sum.tokensIn || 0,
            tokensOut: usage._sum.tokensOut || 0,
            cost: usage._sum.cost || 0,
            avgLatencyMs: usage._avg.latency || 0,
        }]));

        const creditMap = new Map<string, { spent: number; topup: number; bonus: number }>();
        for (const entry of creditTransactions) {
            const current = creditMap.get(entry.teamId) || { spent: 0, topup: 0, bonus: 0 };
            const amount = entry._sum.amount || 0;
            if (entry.type === "usage") current.spent += Math.abs(amount);
            if (entry.type === "topup") current.topup += amount;
            if (entry.type === "bonus") current.bonus += amount;
            creditMap.set(entry.teamId, current);
        }

        const teamRows = teams.map((team) => {
            const usage = usageMap.get(team.id) || { requests: 0, tokensIn: 0, tokensOut: 0, cost: 0, avgLatencyMs: 0 };
            const credits = creditMap.get(team.id) || { spent: 0, topup: 0, bonus: 0 };
            return {
                id: team.id,
                name: team.name,
                createdAt: team.createdAt,
                credits: team.credits,
                memberCount: team.members.length,
                leadCount: team.leads.length,
                campaignCount: team.campaigns.length,
                apiKeyCount: team.apiKeys.length,
                activeApiKeyCount: team.apiKeys.filter((key) => key.isActive).length,
                lastApiKeyUsedAt: latestDate(team.apiKeys.map((key) => key.lastUsedAt)),
                llmRequests: usage.requests,
                tokensIn: usage.tokensIn,
                tokensOut: usage.tokensOut,
                tokenCost: usage.cost,
                avgLatencyMs: usage.avgLatencyMs,
                creditsSpent: credits.spent,
                creditsTopup: credits.topup,
                creditsBonus: credits.bonus,
            };
        });

        const usersRows = users.map((user) => {
            const teamIds = user.memberships.map((membership) => membership.teamId);
            const teamUsage = teamIds.reduce(
                (acc, teamId) => {
                    const usage = usageMap.get(teamId);
                    if (usage) {
                        acc.llmRequests += usage.requests;
                        acc.tokensIn += usage.tokensIn;
                        acc.tokensOut += usage.tokensOut;
                        acc.tokenCost += usage.cost;
                    }
                    return acc;
                },
                { llmRequests: 0, tokensIn: 0, tokensOut: 0, tokenCost: 0 }
            );
            const creditsSpent = user.creditLedger
                .filter((entry) => entry.amount < 0)
                .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                enterpriseRole: user.enterpriseRole,
                credits: user.credits,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                teamCount: teamIds.length,
                teams: user.memberships.map((membership) => ({
                    id: membership.teamId,
                    name: membership.team.name,
                    role: membership.role,
                    status: membership.status,
                })),
                creditsSpent,
                usageAttribution: "team",
                ...teamUsage,
            };
        });

        const totals = teamRows.reduce(
            (acc, team) => {
                acc.users = users.length;
                acc.teams = teams.length;
                acc.activeApiKeys += team.activeApiKeyCount;
                acc.apiKeys += team.apiKeyCount;
                acc.leads += team.leadCount;
                acc.campaigns += team.campaignCount;
                acc.llmRequests += team.llmRequests;
                acc.tokensIn += team.tokensIn;
                acc.tokensOut += team.tokensOut;
                acc.tokenCost += team.tokenCost;
                acc.creditsSpent += team.creditsSpent;
                return acc;
            },
            {
                users: 0,
                teams: 0,
                apiKeys: 0,
                activeApiKeys: 0,
                leads: 0,
                campaigns: 0,
                llmRequests: 0,
                tokensIn: 0,
                tokensOut: 0,
                tokenCost: 0,
                creditsSpent: 0,
                auditEvents: auditCount,
                systemEvents: systemEventCount,
            }
        );

        return NextResponse.json({
            range,
            windowStart: startDate.toISOString(),
            generatedAt: new Date().toISOString(),
            totals,
            users: usersRows,
            teams: teamRows,
            apiKeys: apiKeys.map((key) => ({
                id: key.id,
                name: key.name,
                scopes: key.scopes,
                isActive: key.isActive,
                lastUsedAt: key.lastUsedAt,
                createdAt: key.createdAt,
                teamId: key.teamId,
                teamName: key.team.name,
            })),
            providers: usageByProvider.map((provider) => ({
                provider: provider.provider,
                requests: provider._count.provider || 0,
                tokensIn: provider._sum.tokensIn || 0,
                tokensOut: provider._sum.tokensOut || 0,
                cost: provider._sum.cost || 0,
            })),
            models: usageByModel
                .map((model) => ({
                    model: model.model,
                    requests: model._count.model || 0,
                    tokensIn: model._sum.tokensIn || 0,
                    tokensOut: model._sum.tokensOut || 0,
                    cost: model._sum.cost || 0,
                }))
                .sort((a, b) => b.requests - a.requests)
                .slice(0, 10),
            recentAudit,
            recentSystemEvents,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
