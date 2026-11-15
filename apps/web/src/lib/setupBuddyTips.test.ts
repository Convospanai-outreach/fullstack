import { describe, expect, it } from "vitest";
import { STEP_TIPS, milestoneLine, pickLine, sandLevel, ALL_DONE_LINE, HALFWAY_LINE } from "./setupBuddyTips";

describe("setupBuddyTips", () => {
  it("has at least one tip for each of the 14 wizard steps", () => {
    for (let id = 1; id <= 14; id++) expect(STEP_TIPS[id]?.length ?? 0).toBeGreaterThan(0);
  });

  it("clamps sand level", () => {
    expect(sandLevel(-5)).toBe(0);
    expect(sandLevel(50)).toBe(0.5);
    expect(sandLevel(140)).toBe(1);
    expect(sandLevel(Number.NaN)).toBe(0);
  });

  it("reports milestones only when crossed", () => {
    expect(milestoneLine(40, 50)).toBe(HALFWAY_LINE);
    expect(milestoneLine(50, 60)).toBeNull();
    expect(milestoneLine(90, 100)).toBe(ALL_DONE_LINE);
    expect(milestoneLine(100, 100)).toBeNull();
  });

  it("picks lines deterministically and wraps", () => {
    expect(pickLine(["a", "b"], 3)).toBe("b");
    expect(pickLine(["a", "b"], -2)).toBe("a");
  });
});
