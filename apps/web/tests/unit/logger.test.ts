import { describe, it, expect, vi } from "vitest";
import { logger, logWorker } from "@/lib/logger";

describe("logger lib", () => {
    it("exports a valid logger object", () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe("function");
        expect(typeof logger.warn).toBe("function");
        expect(typeof logger.error).toBe("function");
        expect(typeof logger.debug).toBe("function");
    });

    it("logWorker formats worker log message properly", () => {
        const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
        logWorker("job-123", "COMPLETED", { duration: 100 });

        expect(infoSpy).toHaveBeenCalledWith("[Worker] job-123: COMPLETED", {
            id: "job-123",
            status: "COMPLETED",
            duration: 100,
            category: "worker",
        });
        infoSpy.mockRestore();
    });
});
