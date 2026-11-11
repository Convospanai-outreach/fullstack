import { describe, expect, it } from "vitest";
import { firstResponseSeconds, medianSeconds } from "./responseTime";

const created = new Date("2026-11-01T10:00:00Z");
const at = (minutes: number) => new Date(created.getTime() + minutes * 60_000);

describe("firstResponseSeconds", () => {
  it("is null when the lead has no outbound message", () => {
    expect(firstResponseSeconds(created, [])).toBeNull();
  });

  it("ignores outbound messages sent before the lead was created", () => {
    expect(firstResponseSeconds(created, [at(-5)])).toBeNull();
  });

  it("uses the earliest outbound message at or after creation, whatever order they come in", () => {
    expect(firstResponseSeconds(created, [at(30), at(7), at(-1)])).toBe(7 * 60);
  });

  it("counts an outbound message at the creation instant as zero seconds", () => {
    expect(firstResponseSeconds(created, [at(0)])).toBe(0);
  });
});

describe("medianSeconds", () => {
  it("is null when there are no values", () => {
    expect(medianSeconds([])).toBeNull();
  });

  it("returns the middle value for an odd count", () => {
    expect(medianSeconds([300, 60, 600])).toBe(300);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianSeconds([60, 600, 120, 240])).toBe(180);
  });

  it("skips leads with no response", () => {
    expect(medianSeconds([null, 60, null, 120])).toBe(90);
    expect(medianSeconds([null, null])).toBeNull();
  });
});
