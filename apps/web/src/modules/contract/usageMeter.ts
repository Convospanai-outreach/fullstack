import { prisma } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { ContractResolver } from "./contractResolver";

export class UsageMeter {

    static async checkLimitsOrThrow(teamId: string) {
        const limits = await ContractResolver.getLimits(teamId);
        const usage = await this.getCurrentMonthUsage(teamId);

        if (usage.aiTokens >= limits.aiLimit) {
            await this.logLimitBreach(teamId, "AI_TOKENS", usage.aiTokens, limits.aiLimit);
            throw new Error(`CONTRACT_LIMIT_EXCEEDED: AI_TOKENS (${usage.aiTokens}/${limits.aiLimit})`);
        }

        if (usage.activeThreads >= limits.threadLimit) {
            await this.logLimitBreach(teamId, "THREADS", usage.activeThreads, limits.threadLimit);
            throw new Error(`CONTRACT_LIMIT_EXCEEDED: THREADS (${usage.activeThreads}/${limits.threadLimit})`);
        }
    }

    private static async logLimitBreach(teamId: string, metric: string, used: number, limit: number) {
        const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "CONTRACT_LIMIT_BREACH",
            teamId,
            payload: {
                metric,
                used,
                limit,
                timestamp: new Date()
            }
        });
    }

    static async getCurrentMonthUsage(teamId: string) {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);

        // 1. AI Tokens
        const aiLogs = await prisma.lLMUsageLog.aggregate({
            where: {
                teamId,
                createdAt: { gte: start, lte: end }
            },
            _sum: {
                tokensIn: true,
                tokensOut: true
            }
        });
        const aiTokens = (aiLogs._sum.tokensIn || 0) + (aiLogs._sum.tokensOut || 0);

        // 2. Active Threads (Total created this month vs absolute limit? Usually absolute max active... 
        // but prompt says 'conversationThreadLimit'. I'll assume monthly creation or total active. 
        // Let's go with Total Created This Month for "volume" limit, or Total Active. 
        // Contracts usually limit total active threads or volume. I'll count *created* this month for flow control)
        // Actually, "conversationThreadLimit" often implies standard concurrency or volume.
        // I'll count threads created this month.
        const activeThreads = await prisma.conversationThread.count({
            where: {
                lead: { teamId }, // Implicit relation check via Lead
                createdAt: { gte: start, lte: end }
            }
        });

        // 3. Human Handoffs
        // Count assignments to coordination queue
        const handoffs = await prisma.meetingCoordinationQueue.count({
            where: {
                lead: { teamId },
                createdAt: { gte: start, lte: end }
            }
        });

        return {
            aiTokens,
            activeThreads,
            handoffs
        };
    }

    static async canCreateThread(teamId: string): Promise<boolean> {
        const limits = await ContractResolver.getLimits(teamId);
        const usage = await this.getCurrentMonthUsage(teamId);
        return usage.activeThreads < limits.threadLimit;
    }
}
