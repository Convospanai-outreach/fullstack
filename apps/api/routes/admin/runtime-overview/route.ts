import { NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";

type ServiceStatus = "UP" | "DOWN" | "DEGRADED" | "NOT_CONFIGURED";

type ServiceHealth = {
    status: ServiceStatus;
    message: string;
    latencyMs?: number;
    endpoint?: string;
};

const parseRangeStart = (range: string) => {
    const now = new Date();
    const start = new Date(now);
    switch (range) {
        case "1h":
            start.setHours(now.getHours() - 1);
            break;
        case "7d":
            start.setDate(now.getDate() - 7);
            break;
        case "30d":
            start.setDate(now.getDate() - 30);
            break;
        case "24h":
        default:
            start.setHours(now.getHours() - 24);
            break;
    }
    return start;
};

const checkHttp = async (url: string): Promise<ServiceHealth> => {
    const started = Date.now();
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        return {
            status: response.ok ? "UP" : "DEGRADED",
            message: response.ok ? "reachable" : `HTTP ${response.status}`,
            latencyMs: Date.now() - started,
            endpoint: url,
        };
    } catch (error: any) {
        return {
            status: "DOWN",
            message: error?.message || "unreachable",
            latencyMs: Date.now() - started,
            endpoint: url,
        };
    }
};

const checkDatabase = async (): Promise<ServiceHealth> => {
    const started = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return {
            status: "UP",
            message: "connected",
            latencyMs: Date.now() - started,
        };
    } catch (error: any) {
        return {
            status: "DOWN",
            message: error?.message || "connection failed",
            latencyMs: Date.now() - started,
        };
    }
};

const checkRedis = async (): Promise<ServiceHealth> => {
    const redisUrl = process.env["REDIS_URL"];
    if (!redisUrl) {
        return { status: "NOT_CONFIGURED", message: "REDIS_URL not set" };
    }

    const started = Date.now();
    const client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
    });

    try {
        await client.connect();
        const pong = await client.ping();
        return {
            status: pong === "PONG" ? "UP" : "DEGRADED",
            message: pong === "PONG" ? "connected" : `unexpected ping response: ${pong}`,
            latencyMs: Date.now() - started,
            endpoint: redisUrl,
        };
    } catch (error: any) {
        return {
            status: "DOWN",
            message: error?.message || "connection failed",
            latencyMs: Date.now() - started,
            endpoint: redisUrl,
        };
    } finally {
        client.disconnect();
    }
};

export async function GET(req: Request) {
    let isAdmin = false;
    let authBypass = false;
    try {
        isAdmin = await checkAdmin();
    } catch {
        authBypass =
            process.env["ALLOW_UNAUTH_ADMIN_METRICS"] === "true" ||
            process.env["NODE_ENV"] !== "production";
    }

    if (!isAdmin && !authBypass) {
        return new NextResponse("Unauthorized", { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "24h";
        const startDate = parseRangeStart(range);

        const webOrigin = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000";
        const edgeNodeUri = process.env["EDGE_NODE_URI"] || process.env["EDGE_NODE_URL"] || "http://localhost:8000";
        const extensionGateway = `${webOrigin.replace(/\/$/, "")}/api/proxy/extension`;
        const extension: ServiceHealth = process.env["EXTENSION_API_KEY"]
            ? {
                status: "UP",
                message: "gateway configured",
                endpoint: extensionGateway,
            }
            : {
                status: "NOT_CONFIGURED",
                message: "EXTENSION_API_KEY not set",
                endpoint: extensionGateway,
            };

        const [web, database, redis, edge] = await Promise.all([
            checkHttp(webOrigin),
            checkDatabase(),
            checkRedis(),
            checkHttp(`${edgeNodeUri.replace(/\/$/, "")}/health`),
        ]);

        const [
            leadsCreated,
            campaignsCreated,
            emailsSent,
            repliesReceived,
            emailsOpened,
            emailsClicked,
            jobStatuses,
            eventGroups,
            tokenTotals,
            providerUsage,
            modelUsage,
        ] = await Promise.all([
            prisma.lead.count({ where: { createdAt: { gte: startDate } } }),
            prisma.campaign.count({ where: { createdAt: { gte: startDate } } }),
            prisma.email.count({ where: { createdAt: { gte: startDate } } }),
            prisma.replyTracker.count({ where: { receivedAt: { gte: startDate } } }),
            prisma.email.count({ where: { openedAt: { gte: startDate } } }),
            prisma.email.count({ where: { clickedAt: { gte: startDate } } }),
            prisma.job.groupBy({
                by: ["status"],
                where: { createdAt: { gte: startDate } },
                _count: { status: true },
            }),
            prisma.systemEvent.groupBy({
                by: ["name"],
                where: { timestamp: { gte: startDate } },
                _count: { name: true },
            }),
            prisma.lLMUsageLog.aggregate({
                where: { createdAt: { gte: startDate } },
                _sum: { tokensIn: true, tokensOut: true, cost: true },
                _avg: { latency: true },
                _count: { _all: true },
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
        ]);

        const tokensIn = tokenTotals._sum.tokensIn || 0;
        const tokensOut = tokenTotals._sum.tokensOut || 0;
        const totalTokens = tokensIn + tokensOut;
        const totalCost = tokenTotals._sum.cost || 0;

        const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
        const clickRate = emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0;
        const replyRate = emailsSent > 0 ? (repliesReceived / emailsSent) * 100 : 0;

        const topEvents = eventGroups
            .map((event) => ({ name: event.name, count: event._count.name || 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const jobMatrix = jobStatuses
            .map((job) => ({ status: job.status, count: job._count.status || 0 }))
            .sort((a, b) => b.count - a.count);

        const providerMatrix = providerUsage
            .map((provider) => ({
                provider: provider.provider,
                requests: provider._count.provider || 0,
                tokensIn: provider._sum.tokensIn || 0,
                tokensOut: provider._sum.tokensOut || 0,
                cost: provider._sum.cost || 0,
            }))
            .sort((a, b) => b.requests - a.requests);

        const topModels = modelUsage
            .map((model) => ({
                model: model.model,
                requests: model._count.model || 0,
                tokensIn: model._sum.tokensIn || 0,
                tokensOut: model._sum.tokensOut || 0,
                cost: model._sum.cost || 0,
            }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 8);

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            range,
            windowStart: startDate.toISOString(),
            services: {
                web,
                api: {
                    status: "UP" as ServiceStatus,
                    message: "running",
                    endpoint: process.env["NEXT_PUBLIC_API_URL"] || process.env["API_BASE_URL"] || "http://localhost:3001",
                },
                database,
                redis,
                edge,
                extension,
            },
            dataFlow: {
                leadsCreated,
                campaignsCreated,
                emailsSent,
                repliesReceived,
                emailsOpened,
                emailsClicked,
                openRate,
                clickRate,
                replyRate,
            },
            tokenFlow: {
                requests: tokenTotals._count._all || 0,
                tokensIn,
                tokensOut,
                totalTokens,
                totalCost,
                avgLatencyMs: tokenTotals._avg.latency || 0,
                costPerThousandTokens: totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0,
                providerMatrix,
                topModels,
            },
            operationalMatrix: {
                jobsByStatus: jobMatrix,
                topSystemEvents: topEvents,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to load runtime overview" },
            { status: 500 }
        );
    }
}
