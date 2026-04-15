import { WorkerManager } from "./worker-manager";
import { logger } from "@/lib/logger";

export async function startWorker() {
    const manager = new WorkerManager();

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received, draining worker...`, { category: 'system' });
        await manager.stop();
        logger.info("Worker stopped gracefully.", { category: 'system' });
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    await manager.start();
}

if (require.main === module) {
    startWorker().catch(err => {
        logger.error("Worker failed to start", { error: err });
        process.exit(1);
    });
}
