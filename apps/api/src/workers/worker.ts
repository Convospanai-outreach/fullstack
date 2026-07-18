import { logger } from "@/lib/logger";
import { workerManager } from "./worker-manager";

type ManagedWorker = Pick<typeof workerManager, "start" | "stop">;
type ExitProcess = (code: number) => void;

function safeErrorType(error: unknown) {
    return error instanceof Error && error.name ? error.name : "UnknownError";
}

export function createWorkerLifecycle(manager: ManagedWorker = workerManager) {
    let startPromise: Promise<void> | undefined;
    let shutdownPromise: Promise<void> | undefined;
    let signalHandlersInstalled = false;
    let exitRequested = false;

    const requestShutdown = (signal: string) => {
        if (!shutdownPromise) {
            shutdownPromise = (async () => {
                logger.info(`${signal} received, draining background worker.`, { category: "system" });
                await manager.stop();
                logger.info("Background worker stopped gracefully.", { category: "system" });
            })();
        }
        return shutdownPromise;
    };

    const installSignalHandlers = (exitProcess: ExitProcess = (code) => process.exit(code)) => {
        if (signalHandlersInstalled) return;
        signalHandlersInstalled = true;

        const handleSignal = (signal: "SIGTERM" | "SIGINT") => {
            if (exitRequested) return;
            exitRequested = true;
            void requestShutdown(signal)
                .then(() => exitProcess(0))
                .catch((error) => {
                    logger.error("Background worker shutdown failed.", {
                        category: "system",
                        errorType: safeErrorType(error),
                    });
                    exitProcess(1);
                });
        };

        process.once("SIGTERM", () => handleSignal("SIGTERM"));
        process.once("SIGINT", () => handleSignal("SIGINT"));
    };

    const start = () => {
        if (!startPromise) {
            logger.info("Starting background worker process.", { category: "system" });
            installSignalHandlers();
            startPromise = manager.start();
        }
        return startPromise;
    };

    return { start, requestShutdown, installSignalHandlers };
}

const workerLifecycle = createWorkerLifecycle();

export const startWorker = workerLifecycle.start;
export const stopWorker = workerLifecycle.requestShutdown;
