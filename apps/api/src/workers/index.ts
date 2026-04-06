import { WorkerManager } from "../../workers/worker-manager";

const manager = new WorkerManager();

export async function processNextJob() {
    await manager.start();
}

if (typeof process !== "undefined" && process.env["RUN_WORKER"] === "true") {
    manager.start().catch(err => {
        console.error("Worker failed to start:", err);
        process.exit(1);
    });
}
