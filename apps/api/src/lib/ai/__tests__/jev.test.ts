import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne, mockClientConfig, mockPrisma } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
    mockClientConfig: vi.fn(),
    mockPrisma: { lLMUsageLog: { create: vi.fn() } },
}));

vi.mock("@typesafe-ai/sdk", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@typesafe-ai/sdk")>()),
    TypeSafeClient: class {
        constructor(config: unknown) {
            mockClientConfig(config);
        }
        systemOne = mockSystemOne;
    },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { JevUnavailableError, classifyReply, judgeFriction, judgeStalledThread } from "../jev";

function replyAnswers({ stop = 0.05, away = 0.05, choice = "interested", p = 0.8 }: { stop?: number; away?: number; choice?: string; p?: number }) {
    return {
        model: "jev-1.14.0",
        usage: { input_tokens: 120, output_tokens: 0 },
        answers: {
            asksToStop: { type: "noul", noul: stop },
            isAutoReply: { type: "noul", noul: away },
            response: { type: "choice", choice, confidence: p, probabilities: { interested: 0.1, question: 0.1, not_interested: 0.1, [choice]: p } },
        },
    };
}

describe("jev", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("JEV_API_KEY", "test-key");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("classifyReply", () => {
        it("sends the reply as named state and passes JEV_API_KEY to the client", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({}));
            await classifyReply({ subject: "Re: hi", body: "Sounds good, send pricing" }, "team-1");

            expect(mockClientConfig).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-key", logLevel: "warn" }));
            const request = mockSystemOne.mock.calls[0][0];
            expect(request.state.reply).toEqual({ subject: "Re: hi", body: "Sounds good, send pricing" });
            expect(Object.keys(request.questions)).toEqual(["asksToStop", "isAutoReply", "response"]);
        });

        it("maps the sender's response to its label, with that label's probability", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({ choice: "not_interested", p: 0.86 }));
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).resolves.toMatchObject({ classification: "NOT_INTERESTED", confidence: 0.86 });

            mockSystemOne.mockResolvedValue(replyAnswers({ choice: "question", p: 0.7 }));
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).resolves.toMatchObject({ classification: "QUESTION", confidence: 0.7 });
        });

        it("a request to stop wins over an away message and the response", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({ stop: 0.92, away: 0.9, choice: "not_interested" }));
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).resolves.toMatchObject({ classification: "DNC", confidence: 0.92 });
        });

        it("an away message wins over the response", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({ away: 0.81, choice: "interested" }));
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).resolves.toMatchObject({ classification: "OOO", confidence: 0.81 });
        });

        it("an unsettled stop request keeps the response label and says to check", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({ stop: 0.5, choice: "not_interested", p: 0.9 }));
            const result = await classifyReply({ subject: "", body: "b" }, "team-1");

            expect(result.classification).toBe("NOT_INTERESTED");
            expect(result.reasoning).toContain("May be asking not to be contacted");
        });

        it("logs usage against the team under the typesafe provider", async () => {
            mockSystemOne.mockResolvedValue(replyAnswers({}));
            await classifyReply({ subject: "", body: "b" }, "team-1");

            expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ teamId: "team-1", provider: "typesafe", model: "jev-1.14.0", taskType: "REPLY_CLASSIFICATION", tokensIn: 120, success: true }),
            });
        });

        it("throws, never answers, when the call fails, and logs the failure", async () => {
            mockSystemOne.mockRejectedValue(new Error("503"));
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).rejects.toThrow("503");

            expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: "typesafe", success: false, error: "503" }) });
        });

        it("throws JevUnavailableError without a key, before any call", async () => {
            vi.stubEnv("JEV_API_KEY", "");
            await expect(classifyReply({ subject: "", body: "b" }, "team-1")).rejects.toBeInstanceOf(JevUnavailableError);
            expect(mockSystemOne).not.toHaveBeenCalled();
        });
    });

    describe("judgeFriction", () => {
        it("returns each friction probability in one short attempt, and logs no team usage", async () => {
            mockSystemOne.mockResolvedValue({
                model: "jev-1.14.0",
                usage: { input_tokens: 40, output_tokens: 0 },
                answers: { hostile: { type: "noul", noul: 0.9 }, rejecting: { type: "noul", noul: 0.4 }, spam: { type: "noul", noul: 0.1 } },
            });

            await expect(judgeFriction("You people again? Stop.")).resolves.toEqual({ hostile: 0.9, rejecting: 0.4, spam: 0.1 });
            expect(mockSystemOne.mock.calls[0][0].state).toEqual({ content: "You people again? Stop." });
            expect(mockSystemOne.mock.calls[0][1]).toEqual({ timeout: 5000, retry: { maxRetries: 0 } });
            expect(mockPrisma.lLMUsageLog.create).not.toHaveBeenCalled();
        });
    });
});


describe("judgeStalledThread", () => {
    const probabilities = { wait: 0.1, nudge_now: 0.2, escalate_to_human: 0.3, stop: 0.4 };
    const questionKeys = ["leadWaitingOnUs", "leadAskedToStop", "leadTurnedDown", "nextMove"];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("JEV_API_KEY", "test-key");
        mockSystemOne.mockResolvedValue({
            model: "jev-1.14.0",
            usage: { input_tokens: 120, output_tokens: 0 },
            answers: {
                leadWaitingOnUs: { type: "noul", noul: 0.9 },
                leadAskedToStop: { type: "noul", noul: 0.1 },
                leadTurnedDown: { type: "noul", noul: 0.5 },
                nextMove: { type: "choice", choice: "escalate_to_human", confidence: 0.3, probabilities },
            },
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("asks the four typed questions over the thread and returns the probabilities", async () => {
        const result = await judgeStalledThread({ thread: [{ from: "us", text: "Hi" }], quietForDays: 6 }, "team-1");

        const request = mockSystemOne.mock.calls[0][0];
        expect(Object.keys(request.questions)).toEqual(questionKeys);
        expect(request.state.thread).toEqual([{ from: "us", text: "Hi" }]);
        expect(request.state.quietForDays).toBe(6);
        expect(result).toEqual({
            leadWaitingOnUs: 0.9,
            leadAskedToStop: 0.1,
            leadTurnedDown: 0.5,
            nextMove: { choice: "escalate_to_human", probabilities },
        });
    });

    it("logs usage against the team that asked", async () => {
        await judgeStalledThread({ thread: [], quietForDays: 6 }, "team-7");

        expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledWith({
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
        expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ success: false }) });
    });

    it("rejects with JevUnavailableError when no key is configured, before any call", async () => {
        vi.stubEnv("JEV_API_KEY", "");

        await expect(judgeStalledThread({ thread: [], quietForDays: 6 }, "team-1")).rejects.toBeInstanceOf(JevUnavailableError);
        expect(mockSystemOne).not.toHaveBeenCalled();
    });
});
