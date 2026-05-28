import { startWorker } from "./worker";

console.log("Starting CraftMyFunnel Workers...");
startWorker().catch(err => {
    console.error("Fatal worker error:", err);
    process.exit(1);
});
