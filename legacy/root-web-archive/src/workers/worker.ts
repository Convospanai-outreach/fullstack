import { WorkerManager } from "../../convospan-api/workers/worker-manager";
import { logger } from "@/lib/logger";

export async function startWorker() {
    const manager = new WorkerManager();
    await manager.start();
}

if (require.main === module) {
    startWorker().catch(err => {
        logger.error("Worker failed to start", { error: err });
        process.exit(1);
    });
}
