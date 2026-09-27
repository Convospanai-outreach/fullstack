import "@/lib/sentryInit"; // must stay first: initialises Sentry before anything else loads
import { startWorker } from "./worker";

export async function runBackgroundWorker() {
    console.log("[Worker] Starting CraftMyFunnel background worker.");
    await startWorker();
}

runBackgroundWorker().catch(() => {
    console.error("[Worker] Fatal background worker startup failure.");
    process.exitCode = 1;
});
