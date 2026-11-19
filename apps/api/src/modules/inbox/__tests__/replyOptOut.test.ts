import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnforce, mockRevoke } = vi.hoisted(() => ({ mockEnforce: vi.fn(), mockRevoke: vi.fn() }));

vi.mock("@/modules/governance/ComplianceGuard", () => ({ complianceGuard: { enforceOptOut: mockEnforce } }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({ ConsentService: { revokeConsent: mockRevoke } }));

import { enforceOptOutOnJudgedReply } from "../replyOptOut";

describe("enforceOptOutOnJudgedReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnforce.mockResolvedValue(undefined);
        mockRevoke.mockResolvedValue({});
    });

    it("opts the lead out on a confident DNC email reply", async () => {
        const done = await enforceOptOutOnJudgedReply({ leadId: "lead-1", classification: "DNC", confidence: 1, channel: "EMAIL" });

        expect(done).toBe(true);
        expect(mockEnforce).toHaveBeenCalledWith("lead-1", expect.stringContaining("Email reply"));
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    it("opts out at exactly the confidence bar", async () => {
        expect(await enforceOptOutOnJudgedReply({ leadId: "lead-1", classification: "DNC", confidence: 0.7, channel: "EMAIL" })).toBe(true);
    });

    it("also revokes WhatsApp consent on a DNC WhatsApp reply", async () => {
        await enforceOptOutOnJudgedReply({ leadId: "lead-1", classification: "DNC", confidence: 0.95, channel: "WHATSAPP" });

        expect(mockEnforce).toHaveBeenCalledWith("lead-1", expect.stringContaining("WhatsApp reply"));
        expect(mockRevoke).toHaveBeenCalledWith("lead-1", undefined, expect.stringContaining("WhatsApp reply"), "WHATSAPP");
    });

    it.each([
        ["NOT_INTERESTED", 1],
        ["INTERESTED", 1],
        ["OOO", 1],
        ["QUESTION", 0.9],
        ["UNSURE", 0],
        ["DNC", 0.69],
        ["DNC", 0],
        ["DNC", Number.NaN],
        ["DNC", undefined as unknown as number],
        ["DNC", null as unknown as number],
        [null as unknown as string, 1],
    ])("does not opt anyone out for %s at confidence %s", async (classification, confidence) => {
        const done = await enforceOptOutOnJudgedReply({ leadId: "lead-1", classification, confidence, channel: "WHATSAPP" });

        expect(done).toBe(false);
        expect(mockEnforce).not.toHaveBeenCalled();
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    // A missed opt-out is the costly mistake, so a failure must reach the job and make it retry.
    it("lets a failure propagate instead of swallowing it", async () => {
        mockEnforce.mockRejectedValue(new Error("db down"));

        await expect(enforceOptOutOnJudgedReply({ leadId: "lead-1", classification: "DNC", confidence: 1, channel: "EMAIL" })).rejects.toThrow("db down");
    });

    it("does not report a WhatsApp opt-out as done when revoking consent fails", async () => {
        mockRevoke.mockRejectedValue(new Error("ledger down"));

        await expect(enforceOptOutOnJudgedReply({ leadId: "lead-1", classification: "DNC", confidence: 1, channel: "WHATSAPP" })).rejects.toThrow("ledger down");
    });
});
