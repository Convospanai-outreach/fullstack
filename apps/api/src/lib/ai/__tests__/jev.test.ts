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

import { JevUnavailableError, classifyReply, judgeConfirmationCopy, judgeFriction } from "../jev";

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

    describe("judgeConfirmationCopy", () => {
        const copy = { subject: "Thanks for signing up", body: "We have your details. Reply if you need anything." };

        it("asks one question about the copy only, and returns its probability", async () => {
            mockSystemOne.mockResolvedValue({
                model: "jev-1.14.0",
                usage: { input_tokens: 60, output_tokens: 0 },
                answers: { salesy: { type: "noul", noul: 0.91 } },
            });
            await expect(judgeConfirmationCopy(copy, "team-1")).resolves.toBe(0.91);

            const request = mockSystemOne.mock.calls[0][0];
            expect(request.state).toEqual({ message: copy });
            expect(Object.keys(request.questions)).toEqual(["salesy"]);
            expect(mockSystemOne.mock.calls[0][1]).toEqual({ retry: { maxRetries: 0 } });
        });

        it("logs team usage under CONFIRMATION_COPY_CHECK", async () => {
            mockSystemOne.mockResolvedValue({ model: "jev-1.14.0", usage: { input_tokens: 60, output_tokens: 0 }, answers: { salesy: { type: "noul", noul: 0.1 } } });
            await judgeConfirmationCopy(copy, "team-1");
            expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ teamId: "team-1", taskType: "CONFIRMATION_COPY_CHECK", success: true }),
            });
        });

        it("throws JevUnavailableError without a key, before any call", async () => {
            vi.stubEnv("JEV_API_KEY", "");
            await expect(judgeConfirmationCopy(copy, "team-1")).rejects.toBeInstanceOf(JevUnavailableError);
            expect(mockSystemOne).not.toHaveBeenCalled();
        });

        it("throws when the call fails, so the caller can save without a warning", async () => {
            mockSystemOne.mockRejectedValue(new Error("timeout"));
            await expect(judgeConfirmationCopy(copy, "team-1")).rejects.toThrow("timeout");
        });
    });
});
