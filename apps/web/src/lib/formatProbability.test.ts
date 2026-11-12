import { describe, expect, it } from "vitest";
import { formatProbability } from "./formatProbability";

describe("formatProbability", () => {
    it("formats to two decimals", () => expect(formatProbability(0.8512)).toBe("85.12%"));
    it("never shows scientific notation", () => expect(formatProbability(1e-7)).toBe("< 0.01%"));
    it("keeps exact zero and one", () => {
        expect(formatProbability(0)).toBe("0.00%");
        expect(formatProbability(1)).toBe("100.00%");
    });
    it("shows a dash for missing or invalid values", () => {
        expect(formatProbability(undefined)).toBe("—");
        expect(formatProbability(null)).toBe("—");
        expect(formatProbability(Number.NaN)).toBe("—");
    });
});
