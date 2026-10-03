import { prisma } from "@/lib/db";

/** Records that a long-running process is alive. Never throws. */
export async function recordHeartbeat(service: string, startedAt: Date, meta: Record<string, number>): Promise<void> {
    const now = new Date();
    try {
        await prisma.serviceHeartbeat.upsert({
            where: { service },
            create: { service, startedAt, lastSeenAt: now, meta },
            update: { startedAt, lastSeenAt: now, meta },
        });
    } catch (error) {
        console.warn(`[Heartbeat] ${service} heartbeat failed:`, error instanceof Error ? error.message : error);
    }
}

/** Basic process numbers worth showing an operator (the VMs have under 1 GB of RAM). */
export function processStats() {
    const memory = process.memoryUsage();
    return {
        uptimeSec: Math.round(process.uptime()),
        rssMb: Math.round(memory.rss / 1048576),
        heapUsedMb: Math.round(memory.heapUsed / 1048576),
    };
}
