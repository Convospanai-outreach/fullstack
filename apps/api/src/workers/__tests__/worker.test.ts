import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkerLifecycle } from "../worker";

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("../worker-manager", () => ({
    workerManager: {
        start: vi.fn(),
        stop: vi.fn(),
    },
}));

describe("background worker lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("starts the supplied worker manager exactly once", async () => {
        const manager = {
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined),
        };
        const lifecycle = createWorkerLifecycle(manager);

        await lifecycle.start();
        await lifecycle.start();

        expect(manager.start).toHaveBeenCalledTimes(1);
    });

    it("deduplicates graceful shutdown requests and waits for the worker drain", async () => {
        let releaseDrain!: () => void;
        const manager = {
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockImplementation(() => new Promise<void>((resolve) => { releaseDrain = resolve; })),
        };
        const lifecycle = createWorkerLifecycle(manager);

        const firstShutdown = lifecycle.requestShutdown("SIGTERM");
        const duplicateShutdown = lifecycle.requestShutdown("SIGINT");
        expect(manager.stop).toHaveBeenCalledTimes(1);

        releaseDrain();
        await Promise.all([firstShutdown, duplicateShutdown]);
        expect(manager.stop).toHaveBeenCalledTimes(1);
    });
});
