import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/linkedin/puppeteerRunner", () => ({
    runLinkedInAction: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { logger } from "@/lib/logger";
import { linkedinRunnerService } from "../linkedinRunnerService";

describe("linkedinRunnerService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("runAutomation", () => {
        it("runs the real puppeteer automation and wraps the result", async () => {
            (runLinkedInAction as any).mockResolvedValue({
                ok: true,
                action: "scrape",
                data: { name: "Jane Doe" },
            });

            const result = await linkedinRunnerService.runAutomation({
                profileUrl: "https://linkedin.com/in/jane",
                action: "scrape",
            });

            expect(runLinkedInAction).toHaveBeenCalledWith({
                profileUrl: "https://linkedin.com/in/jane",
                action: "scrape",
            });
            expect(result).toEqual({
                result: { ok: true, action: "scrape", data: { name: "Jane Doe" } },
            });
        });

        it("throws when the automation result reports failure", async () => {
            (runLinkedInAction as any).mockResolvedValue({
                ok: false,
                error: "Action connect not implemented in puppeteer runner yet.",
            });

            await expect(
                linkedinRunnerService.runAutomation({
                    profileUrl: "https://linkedin.com/in/jane",
                    action: "connect",
                })
            ).rejects.toThrow("Action connect not implemented in puppeteer runner yet.");
            expect(logger.error).toHaveBeenCalled();
        });

        it("logs and rethrows when the automation itself throws", async () => {
            (runLinkedInAction as any).mockRejectedValue(new Error("browser launch failed"));

            await expect(
                linkedinRunnerService.runAutomation({
                    profileUrl: "https://linkedin.com/in/jane",
                    action: "scrape",
                })
            ).rejects.toThrow("browser launch failed");
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
