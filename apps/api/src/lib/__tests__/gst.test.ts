import { describe, expect, it } from "vitest";
import { computeGstExclusive, computeGstInclusive } from "@/lib/gst";

describe("computeGstExclusive", () => {
    it("adds CGST/SGST on top for a Delhi (same-state-as-seller) customer", () => {
        const result = computeGstExclusive(9900, "IN", "Delhi");
        expect(result).toEqual({ taxableValue: 9900, taxAmount: 1782, taxType: "CGST_SGST", taxRate: 18, totalAmount: 11682 });
    });

    it("adds IGST on top for an Indian customer outside Delhi", () => {
        const result = computeGstExclusive(4900, "IN", "Maharashtra");
        expect(result.taxType).toBe("IGST");
        expect(result.taxRate).toBe(18);
        expect(result.totalAmount).toBe(result.taxableValue + result.taxAmount);
    });

    it("adds no surcharge for non-India customers (zero-rated export of services)", () => {
        const result = computeGstExclusive(4900, "US");
        expect(result).toEqual({ taxableValue: 4900, taxAmount: 0, taxType: "NONE", taxRate: null, totalAmount: 4900 });
    });
});

describe("computeGstInclusive", () => {
    it("splits an already-charged Delhi amount into taxable value + CGST/SGST", () => {
        const result = computeGstInclusive(9900, "IN", "Delhi");
        expect(result).toEqual({ taxableValue: 8390, taxAmount: 1510, taxType: "CGST_SGST", taxRate: 18, totalAmount: 9900 });
    });

    it("treats non-India customers as zero-rated export of services", () => {
        const result = computeGstInclusive(4900, "US");
        expect(result).toEqual({ taxableValue: 4900, taxAmount: 0, taxType: "NONE", taxRate: null, totalAmount: 4900 });
    });

    it("keeps taxableValue + taxAmount equal to the original amount (no rounding leakage)", () => {
        for (const amount of [1, 99, 4900, 9900, 49900, 123456]) {
            const result = computeGstInclusive(amount, "IN", "Delhi");
            expect(result.taxableValue + result.taxAmount).toBe(amount);
        }
    });
});
