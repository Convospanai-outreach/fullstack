// Sudhisha Digital Private Limited is GST-registered in Delhi (GSTIN 07ABOCS1373C1ZC).
// 18% is the standard GST rate for SaaS/software services in India.
export const GST_RATE = 18;
export const SELLER_STATE = "Delhi";

export type GstBreakup = {
    taxableValue: number;
    taxAmount: number;
    taxType: "CGST_SGST" | "IGST" | "NONE";
    taxRate: number | null;
    totalAmount: number;
};

/**
 * Adds GST on top of a base (taxable) price. Used at order-creation time
 * (checkout/topup), where the amount actually charged must include the
 * surcharge. Non-India sales are zero-rated export of services.
 */
export function computeGstExclusive(baseAmount: number, country: string, state?: string | null): GstBreakup {
    if (country !== "IN") {
        return { taxableValue: baseAmount, taxAmount: 0, taxType: "NONE", taxRate: null, totalAmount: baseAmount };
    }

    const taxAmount = Math.round((baseAmount * GST_RATE) / 100);
    const taxType = state === SELLER_STATE ? "CGST_SGST" : "IGST";

    return { taxableValue: baseAmount, taxAmount, taxType, taxRate: GST_RATE, totalAmount: baseAmount + taxAmount };
}

/**
 * Extracts GST from an already-charged, tax-inclusive amount. Only valid
 * when no surcharge could have been added at order-creation time (e.g. a
 * payment whose notes don't match a known checkout/topup shape) - it cannot
 * recover revenue that should have been collected but wasn't.
 */
export function computeGstInclusive(amount: number, country: string, state?: string | null): GstBreakup {
    if (country !== "IN") {
        return { taxableValue: amount, taxAmount: 0, taxType: "NONE", taxRate: null, totalAmount: amount };
    }

    const taxableValue = Math.round(amount / (1 + GST_RATE / 100));
    const taxAmount = amount - taxableValue;
    const taxType = state === SELLER_STATE ? "CGST_SGST" : "IGST";

    return { taxableValue, taxAmount, taxType, taxRate: GST_RATE, totalAmount: amount };
}
