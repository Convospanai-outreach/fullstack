import { describe, expect, it } from "vitest";
import { ApprovalTier, computeAutoDenyAt, resolveApprovalTier } from "./approvalPolicy";

describe("resolveApprovalTier", () => {
    it("defaults unknown action types to QUEUED", () => {
        expect(resolveApprovalTier("CAMPAIGN_START")).toBe(ApprovalTier.QUEUED);
        expect(resolveApprovalTier("MCP_TOOL_EXECUTION")).toBe(ApprovalTier.QUEUED);
        expect(resolveApprovalTier("SOMETHING_NEW")).toBe(ApprovalTier.QUEUED);
    });

    it("escalates to HARD_BLOCK when forceHardBlock is set, regardless of action type", () => {
        expect(resolveApprovalTier("CAMPAIGN_START", { forceHardBlock: true })).toBe(ApprovalTier.HARD_BLOCK);
    });
});

describe("computeAutoDenyAt", () => {
    it("returns a 24h-out timestamp for QUEUED tier", () => {
        const now = new Date("2026-08-30T00:00:00.000Z");
        const result = computeAutoDenyAt(ApprovalTier.QUEUED, now);
        expect(result?.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    });

    it("returns null for AUTO and HARD_BLOCK tiers", () => {
        expect(computeAutoDenyAt(ApprovalTier.AUTO)).toBeNull();
        expect(computeAutoDenyAt(ApprovalTier.HARD_BLOCK)).toBeNull();
    });

    it("returns a 72h-out timestamp for QUEUED tier when extended (breaker OPEN/HALF_OPEN)", () => {
        const now = new Date("2026-08-30T00:00:00.000Z");
        const result = computeAutoDenyAt(ApprovalTier.QUEUED, now, true);
        expect(result?.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    });

    it("ignores the extended flag for non-QUEUED tiers", () => {
        expect(computeAutoDenyAt(ApprovalTier.HARD_BLOCK, new Date(), true)).toBeNull();
    });
});
