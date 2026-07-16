import { JobClaim, JobClaimLostError, JobQueue } from "@/lib/queue";
import { schedulerService } from "@/modules/scheduler/schedulerService";
import { worker } from "./job-processor";

export class WorkerManager {
    private isRunning: boolean = false;
    private idleDelay: number = 2000;
    private activeJobs: Set<string> = new Set();
    private concurrencyLimit: number = parseInt(process.env['WORKER_CONCURRENCY'] || '5');
    private scheduleInterval: number = parseInt(process.env['SCHEDULE_INTERVAL_MS'] || '60000');
    private lastScheduleTick: number = 0;
    private lastStaleResetTick: number = 0;
    private lastMailboxSyncTick: number = 0;
    private lastWarmupTick: number = 0;
    private staleResetInterval: number = 5 * 60 * 1000; // 5 minutes
    private mailboxSyncInterval: number = parseInt(process.env['GOOGLE_MAILBOX_WORKER_INTERVAL_MS'] || '600000'); // 10 minutes
    private warmupInterval: number = parseInt(process.env['GOOGLE_MAILBOX_WARMUP_INTERVAL_MS'] || '3600000'); // 1 hour

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
                        this.executeJob({ jobId: job.id, version: job.version });
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

        if (now - this.lastMailboxSyncTick >= this.mailboxSyncInterval) {
            console.log("[Worker] Syncing due Google mailboxes...");
            const { renewDueGoogleMailboxWatches, syncDueGoogleMailboxes } = await import("@/modules/email-campaigner/service/googleMailboxService");
            const renewals = await renewDueGoogleMailboxWatches();
            const renewedCount = renewals.filter((result) => result.renewed).length;
            if (renewedCount > 0) {
                console.log(`[Worker] Renewed ${renewedCount} Gmail mailbox watches.`);
            }
            const results = await syncDueGoogleMailboxes();
            if (results.length > 0) {
                console.log(`[Worker] Synced ${results.length} Google mailboxes.`);
            }
            this.lastMailboxSyncTick = now;
        }

        if (now - this.lastWarmupTick >= this.warmupInterval) {
            console.log("[Worker] Advancing mailbox warmup state...");
            const { advanceMailboxWarmup } = await import("@/modules/email-campaigner/service/googleMailboxService");
            const result = await advanceMailboxWarmup();
            if (result.count > 0) {
                console.log(`[Worker] Advanced warmup for ${result.count} mailboxes.`);
            }
            this.lastWarmupTick = now;
        }
    }

    private async executeJob(claim: JobClaim) {
        this.activeJobs.add(claim.jobId);
        try {
            console.log(`[Worker] Executing job ${claim.jobId}`);
            await worker.performJob(claim);
        } catch (error) {
            if (error instanceof JobClaimLostError) {
                console.info(`[Worker] Job ${claim.jobId} claim was superseded; stopping stale worker.`);
                return;
            }
            console.error(`[Worker] Job ${claim.jobId} execution failed:`, error);
        } finally {
            this.activeJobs.delete(claim.jobId);
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

