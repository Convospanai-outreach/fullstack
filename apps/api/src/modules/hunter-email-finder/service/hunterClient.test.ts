import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression for roadmap B-07: axios has no default timeout, so a stalled Hunter
// request hangs the caller. Assert every request carries a 10s timeout.

const { mockGet } = vi.hoisted(() => {
    process.env["HUNTER_IO_API_KEY"] = "test-key";
    return { mockGet: vi.fn() };
});

vi.mock("axios", () => ({ default: { get: mockGet } }));

import { hunterClient } from "./hunterClient";

describe("hunterClient timeouts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue({ data: { data: {}, meta: {} } });
    });

    it("passes a 10s timeout to the email-finder request", async () => {
        await hunterClient.findEmail("Ada", "Lovelace", "example.com");

        expect(mockGet).toHaveBeenCalledTimes(1);
        const config = mockGet.mock.calls[0][1] as { timeout?: number };
        expect(config.timeout).toBe(10_000);
    });

    it("passes a 10s timeout to the email-verifier request", async () => {
        await hunterClient.verifyEmail("ada@example.com");

        const config = mockGet.mock.calls[0][1] as { timeout?: number };
        expect(config.timeout).toBe(10_000);
    });
});
