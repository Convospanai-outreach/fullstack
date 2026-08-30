import { JobClaim, JobClaimLostError, JobQueue } from "@/lib/queue";
import { schedulerService } from "@/modules/scheduler/schedulerService";
import { worker } from "./job-processor";

function safeErrorType(error: unknown) {
    return error instanceof Error && error.name ? error.name : "UnknownError";
}

export class WorkerManager {
    private isRunning: boolean = false;
    private idleDelay: number = 2000;
    private activeJobs: Set<string> = new Set();
    private activeExecutions: Map<string, Promise<void>> = new Map();
    private concurrencyLimit: number = parseInt(process.env['WORKER_CONCURRENCY'] || '5');
    private scheduleInterval: number = parseInt(process.env['SCHEDULE_INTERVAL_MS'] || '60000');
    private lastScheduleTick: number = 0;
    private lastSequenceTick: number = 0;
    private lastStaleResetTick: number = 0;
    private lastMailboxSyncTick: number = 0;
    private lastWarmupTick: number = 0;
    private lastWarmupSeedTick: number = 0;
    private lastOutboxTick: number = 0;
    private lastApprovalSweepTick: number = 0;
    private sequenceInterval: number = parseInt(process.env['SEQUENCE_PROCESS_INTERVAL_MS'] || '60000');
    private staleResetInterval: number = 5 * 60 * 1000; // 5 minutes
    private mailboxSyncInterval: number = parseInt(process.env['GOOGLE_MAILBOX_WORKER_INTERVAL_MS'] || '600000'); // 10 minutes
    private warmupInterval: number = parseInt(process.env['GOOGLE_MAILBOX_WARMUP_INTERVAL_MS'] || '3600000'); // 1 hour
    private warmupSeedInterval: number = parseInt(process.env['WARMUP_SEED_INTERVAL_MS'] || '3600000'); // 1 hour
    private outboxInterval: number = parseInt(process.env['OUTBOX_RELAY_INTERVAL_MS'] || '2000'); // 2 seconds
    private approvalSweepInterval: number = parseInt(process.env['APPROVAL_SWEEP_INTERVAL_MS'] || '900000'); // 15 minutes
    private lastOverseerTick: number = 0;
    private overseerInterval: number = parseInt(process.env['OVERSEER_TICK_INTERVAL_MS'] || '1800000'); // 30 minutes

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
                    // A job dequeued before shutdown began is already an owned
                    // claim and must run to completion rather than be stranded.
                    if (job) {
                        void this.executeJob({ jobId: job.id, version: job.version });
                        // Continue loop immediately to fill capacity
                        continue;
                    }
                }

                // 3. Idle wait
                await new Promise(resolve => setTimeout(resolve, this.idleDelay));
            } catch (error) {
                console.error(`[Worker] Loop error (${safeErrorType(error)}).`);
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

        // Advance due CampaignSequence enrollments (nothing else drives this periodically -
        // see OPEN-32)
        if (now - this.lastSequenceTick >= this.sequenceInterval) {
            console.log("[Worker] Processing due sequence steps...");
            const { SequenceService } = await import("@/modules/email-campaigner/service/sequenceService");
            const results = await SequenceService.processDue({});
            if (results.length > 0) {
                console.log(`[Worker] Processed ${results.length} due sequence step(s).`);
            }
            this.lastSequenceTick = now;
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

        if (now - this.lastWarmupSeedTick >= this.warmupSeedInterval) {
            console.log("[Worker] Sending warmup seed traffic...");
            const { sendWarmupSeedTraffic } = await import("@/modules/email-campaigner/service/warmupSeedService");
            const result = await sendWarmupSeedTraffic();
            if (result.sent > 0) {
                console.log(`[Worker] Sent warmup seed traffic for ${result.sent} mailbox(es).`);
            }
            this.lastWarmupSeedTick = now;
        }

        if (now - this.lastOutboxTick >= this.outboxInterval) {
            const { OutboxService } = await import("@/lib/outboxService");
            const relayedCount = await OutboxService.relayPendingEvents(50);
            if (relayedCount > 0) {
                console.log(`[Worker] Relayed ${relayedCount} outbox event(s).`);
            }
            this.lastOutboxTick = now;
        }

        if (now - this.lastApprovalSweepTick >= this.approvalSweepInterval) {
            const { ApprovalService } = await import("@/modules/governance/ApprovalService");
            const deniedCount = await ApprovalService.autoDenyExpiredApprovals();
            if (deniedCount > 0) {
                console.log(`[Worker] Auto-denied ${deniedCount} expired QUEUED-tier approval request(s).`);
            }
            this.lastApprovalSweepTick = now;
        }

        if (now - this.lastOverseerTick >= this.overseerInterval) {
            const { processOverseerTick } = await import("./handlers/overseerHandler");
            const result = await processOverseerTick();
            if (result.nudgesCreated > 0) {
                console.log(`[Worker] Overseer flagged ${result.nudgesCreated} stalled enrollment(s) out of ${result.candidates} candidate(s).`);
            }
            this.lastOverseerTick = now;
        }
    }

    private claimKey(claim: JobClaim) {
        return JSON.stringify([claim.jobId, claim.version]);
    }

    private async executeJob(claim: JobClaim) {
        const key = this.claimKey(claim);
        this.activeJobs.add(key);
        const execution = (async () => {
            try {
                console.log(`[Worker] Executing job ${claim.jobId} (claim ${claim.version}).`);
                await worker.performJob(claim);
            } catch (error) {
                if (error instanceof JobClaimLostError) {
                    console.info(`[Worker] Job ${claim.jobId} claim was superseded; stopping stale worker.`);
                    return;
                }
                console.error(`[Worker] Job ${claim.jobId} execution failed (${safeErrorType(error)}).`);
            } finally {
                this.activeJobs.delete(key);
                this.activeExecutions.delete(key);
            }
        })();
        this.activeExecutions.set(key, execution);
        return execution;
    }

    async stop() {
        console.log("[Worker] Stopping loop...");
        this.isRunning = false;

        if (this.activeExecutions.size > 0) {
            console.log(`[Worker] Draining ${this.activeExecutions.size} active job claims...`);
            await Promise.allSettled(Array.from(this.activeExecutions.values()));
        }
        console.log("[Worker] Shutdown complete.");
    }
}

export const workerManager = new WorkerManager();

