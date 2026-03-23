import { startWorker } from "./worker";

console.log("Starting ConvoSpan Workers...");
startWorker().catch(err => {
    console.error("Fatal worker error:", err);
    process.exit(1);
});
