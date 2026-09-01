import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        guardrailPolicy: { findUnique: vi.fn() },
        guardrailLog: { create: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

import { GuardrailService } from "./guardrailService";

describe("GuardrailService - custom regex rules", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.guardrailLog.create.mockResolvedValue({});
    });

    it("flags content that matches a valid custom regex rule", async () => {
        mockPrisma.guardrailPolicy.findUnique.mockResolvedValue({
            teamId: "team-1",
            detectPII: false,
            blocklist: [],
            competitorMentions: [],
            regexRules: ["secret-\\d+"],
        });

        const result = await new GuardrailService().evaluate("team-1", "the code is secret-42");

        expect(result.isSafe).toBe(false);
        expect(result.violations[0]).toMatchObject({ type: "REGEX", snippet: "secret-42" });
    });

    it("does not flag content when no custom regex rule matches", async () => {
        mockPrisma.guardrailPolicy.findUnique.mockResolvedValue({
            teamId: "team-1",
            detectPII: false,
            blocklist: [],
            competitorMentions: [],
            regexRules: ["secret-\\d+"],
        });

        const result = await new GuardrailService().evaluate("team-1", "nothing sensitive here");

        expect(result.isSafe).toBe(true);
    });

    it("treats an invalid regex pattern as a non-match instead of throwing", async () => {
        mockPrisma.guardrailPolicy.findUnique.mockResolvedValue({
            teamId: "team-1",
            detectPII: false,
            blocklist: [],
            competitorMentions: [],
            regexRules: ["("],
        });

        await expect(new GuardrailService().evaluate("team-1", "anything")).resolves.toEqual({
            isSafe: true,
            violations: [],
        });
    });

    it("bounds a catastrophically-backtracking pattern instead of hanging the process (OPEN-106)", async () => {
        mockPrisma.guardrailPolicy.findUnique.mockResolvedValue({
            teamId: "team-1",
            detectPII: false,
            blocklist: [],
            competitorMentions: [],
            regexRules: ["(a+)+$"],
        });
        // Long run of a's that never ends in the required suffix - classic exponential
        // backtracking trigger for this pattern.
        const evilContent = `${"a".repeat(40)}b`;

        const start = Date.now();
        const result = await new GuardrailService().evaluate("team-1", evilContent);
        const elapsedMs = Date.now() - start;

        expect(result.isSafe).toBe(true);
        expect(elapsedMs).toBeLessThan(2000);
    }, 5000);
});
