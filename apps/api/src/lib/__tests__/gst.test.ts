import { describe, expect, it } from "vitest";
import { computeGst } from "@/lib/gst";

describe("computeGst", () => {
    it("splits CGST/SGST for a Delhi (same-state-as-seller) customer", () => {
        const result = computeGst(9900, "IN", "Delhi");
        expect(result).toEqual({ taxableValue: 8390, taxAmount: 1510, taxType: "CGST_SGST", taxRate: 18 });
    });

    it("charges IGST for an Indian customer outside Delhi", () => {
        const result = computeGst(4900, "IN", "Maharashtra");
        expect(result.taxType).toBe("IGST");
        expect(result.taxRate).toBe(18);
        expect(result.taxableValue + result.taxAmount).toBe(4900);
    });

    it("treats non-India customers as zero-rated export of services", () => {
        const result = computeGst(4900, "US");
        expect(result).toEqual({ taxableValue: 4900, taxAmount: 0, taxType: "NONE", taxRate: null });
    });

    it("keeps taxableValue + taxAmount equal to the original amount (no rounding leakage)", () => {
        for (const amount of [1, 99, 4900, 9900, 49900, 123456]) {
            const result = computeGst(amount, "IN", "Delhi");
            expect(result.taxableValue + result.taxAmount).toBe(amount);
        }
    });
});
