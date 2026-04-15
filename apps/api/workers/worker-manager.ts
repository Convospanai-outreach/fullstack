import { JobQueue } from "@/lib/queue";
import { schedulerService } from "@/modules/scheduler/schedulerService";
import { worker } from "./worker";

export class WorkerManager {
    private isRunning: boolean = false;
    private idleDelay: number = 2000;
    private activeJobs: Set<string> = new Set();
    private concurrencyLimit: number = parseInt(process.env['WORKER_CONCURRENCY'] || '5');
    private scheduleInterval: number = parseInt(process.env['SCHEDULE_INTERVAL_MS'] || '60000');
    private lastScheduleTick: number = 0;
    private lastStaleResetTick: number = 0;
    private staleResetInterval: number = 5 * 60 * 1000; // 5 minutes

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[Worker] Starting management loop (Concurrency: ${this.concurrencyLimit})`);

        while (this.isRunning) {
            try {
                // 1. Internal Scheduler & Watchdog Tick
                await this.handleMaintenanceTick();

                // 2. Job Dequeue (if capacity available)
                if (this.activeJobs.size < this.concurrencyLimit) {
                    const job = await JobQueue.dequeue();
                    if (job) {
                        this.executeJob(job.id);
                        // Continue loop immediately to fill capacity
                        continue;
                    }
                }

                // 3. Idle wait
                await new Promise(resolve => setTimeout(resolve, this.idleDelay));
            } catch (error) {
                console.error("[Worker] Loop error:", error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    private async handleMaintenanceTick() {
        const now = Date.now();

        // Run scheduler every minute
        if (now - this.lastScheduleTick >= this.scheduleInterval) {
            console.log("[Worker] Running internal scheduler tick...");
            await schedulerService.processDueSchedules();
            this.lastScheduleTick = now;
        }

        // Fix [HIGH-2]: Reset stale jobs every 5 minutes
        if (now - this.lastStaleResetTick >= this.staleResetInterval) {
            console.log("[Worker] Running stale job watchdog...");
            const resetCount = await JobQueue.resetStaleJobs();
            if (resetCount > 0) {
                console.log(`[Worker] Watchdog reset ${resetCount} stuck jobs.`);
            }
            this.lastStaleResetTick = now;
        }
    }

    private async executeJob(jobId: string) {
        this.activeJobs.add(jobId);
        try {
            console.log(`[Worker] Executing job ${jobId}`);
            await worker.performJob(jobId);
        } catch (error) {
            console.error(`[Worker] Job ${jobId} execution failed:`, error);
        } finally {
            this.activeJobs.delete(jobId);
        }
    }

    async stop() {
        console.log("[Worker] Stopping loop...");
        this.isRunning = false;

        // Graceful Drain
        if (this.activeJobs.size > 0) {
            console.log(`[Worker] Draining ${this.activeJobs.size} active jobs...`);
            let attempts = 0;
            while (this.activeJobs.size > 0 && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
        }
        console.log("[Worker] Shutdown complete.");
    }
}

export const workerManager = new WorkerManager();
