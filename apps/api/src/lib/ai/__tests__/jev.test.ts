import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne, mockUsageCreate } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
    mockUsageCreate: vi.fn(),
}));

vi.mock("@typesafe-ai/sdk", () => ({
    TypeSafeClient: class {
        systemOne = mockSystemOne;
    },
    choice: (question: string, options: unknown) => ({ kind: "choice", question, options }),
    noul: (question: string, criteria: unknown) => ({ kind: "noul", question, criteria }),
}));

vi.mock("@/lib/db", () => ({
    prisma: { lLMUsageLog: { create: mockUsageCreate } },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { JevUnavailableError, judgeStalledThread } from "../jev";

const probabilities = { wait: 0.1, nudge_now: 0.2, escalate_to_human: 0.3, stop: 0.4 };

describe("judgeStalledThread", () => {
    beforeEach(() => {
        vi.stubEnv("JEV_API_KEY", "test-key");
        mockUsageCreate.mockResolvedValue({});
        mockSystemOne.mockResolvedValue({
            model: "jev-1.14.0",
            usage: { input_tokens: 120 },
            answers: {
                leadWaitingOnUs: { noul: 0.9 },
                leadAskedToStop: { noul: 0.1 },
                leadTurnedDown: { noul: 0.5 },
                nextMove: { choice: "escalate_to_human", probabilities },
            },
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("asks the four typed questions over the thread and returns the probabilities", async () => {
        const result = await judgeStalledThread({ thread: [{ from: "us", text: "Hi" }], quietForDays: 6 }, "team-1");

        expect(mockSystemOne).toHaveBeenCalledWith(
            {
                state: expect.objectContaining({ thread: [{ from: "us", text: "Hi" }], quietForDays: 6 }),
                questions: expect.objectContaining({
                    leadWaitingOnUs: expect.objectContaining({ kind: "noul" }),
                    leadAskedToStop: expect.objectContaining({ kind: "noul" }),
                    leadTurnedDown: expect.objectContaining({ kind: "noul" }),
                    nextMove: expect.objectContaining({ kind: "choice" }),
                }),
            },
            expect.anything(),
        );
        expect(result).toEqual({
            leadWaitingOnUs: 0.9,
            leadAskedToStop: 0.1,
            leadTurnedDown: 0.5,
            nextMove: { choice: "escalate_to_human", probabilities },
        });
    });

    it("records usage against the team that asked", async () => {
        await judgeStalledThread({ thread: [], quietForDays: 6 }, "team-7");

        expect(mockUsageCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-7", taskType: "STALL_JUDGMENT", provider: "typesafe", success: true }),
        });
    });

    it("caps the thread it sends: the last five messages, each at most 1000 characters", async () => {
        const thread = Array.from({ length: 8 }, (_, i) => ({ from: "lead" as const, text: `m${i}-${"x".repeat(3000)}` }));

        await judgeStalledThread({ thread, quietForDays: 6 }, "team-1");

        const sent = mockSystemOne.mock.calls[0][0].state.thread as Array<{ text: string }>;
        expect(sent).toHaveLength(5);
        expect(sent[0].text.startsWith("m3-")).toBe(true);
        expect(sent.every((m) => m.text.length <= 1000)).toBe(true);
    });

    it("rejects, and never returns an answer, when the call fails", async () => {
        mockSystemOne.mockRejectedValue(new Error("timeout"));

        await expect(judgeStalledThread({ thread: [], quietForDays: 6 }, "team-1")).rejects.toThrow("timeout");
        expect(mockUsageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ success: false }) });
    });

    it("rejects with JevUnavailableError when no key is configured", async () => {
        vi.stubEnv("JEV_API_KEY", "");

        await expect(judgeStalledThread({ thread: [], quietForDays: 6 }, "team-1")).rejects.toBeInstanceOf(JevUnavailableError);
        expect(mockSystemOne).not.toHaveBeenCalled();
    });
});
