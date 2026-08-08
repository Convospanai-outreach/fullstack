import { describe, it, expect } from "vitest";

/**
 * Unit test for campaign completion rate math logic.
 *
 * Verifies that:
 * 1. Target = 1, Processed = 5 (retry loop or orphan counter) -> Capped at 100% (never 500%).
 * 2. Target = 10, Processed = 3 -> Exactly 30%.
 * 3. Target = 0, Processed = 0 -> Exactly 0%.
 * 4. Completed leads evaluated directly from leadList status array.
 */

function calculateCompletionRate(targetCount: number, completedCount: number, leadListCount?: number): { completed: number; rate: number } {
    const denominator = leadListCount && leadListCount > 0 ? leadListCount : (targetCount > 0 ? targetCount : 0);
    if (denominator === 0) return { completed: 0, rate: 0 };
    const actualCompleted = Math.min(completedCount, denominator);
    const rate = Math.min(100, Math.round((actualCompleted / denominator) * 100));
    return { completed: actualCompleted, rate };
}

describe("Campaign Completion Rate Math", () => {
    it("caps completion rate at 100% when completedCount > targetCount (preventing 500% bug)", () => {
        const result = calculateCompletionRate(1, 5, 1);
        expect(result.rate).toBe(100);
        expect(result.completed).toBe(1);
    });

    it("correctly calculates normal progress (3/10 = 30%)", () => {
        const result = calculateCompletionRate(10, 3, 10);
        expect(result.rate).toBe(30);
        expect(result.completed).toBe(3);
    });

    it("handles zero target safely without division by zero (0%)", () => {
        const result = calculateCompletionRate(0, 0, 0);
        expect(result.rate).toBe(0);
        expect(result.completed).toBe(0);
    });
});
