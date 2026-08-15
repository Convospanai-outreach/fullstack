// Sudhisha Digital Private Limited is GST-registered in Delhi (GSTIN 07ABOCS1373C1ZC).
// 18% is the standard GST rate for SaaS/software services in India.
export const GST_RATE = 18;
export const SELLER_STATE = "Delhi";

export type GstBreakup = {
    taxableValue: number;
    taxAmount: number;
    taxType: "CGST_SGST" | "IGST" | "NONE";
    taxRate: number | null;
};

/**
 * Amount is treated as tax-inclusive for domestic (India) sales.
 * Non-India sales are treated as zero-rated export of services.
 */
export function computeGst(amount: number, country: string, state?: string | null): GstBreakup {
    if (country !== "IN") {
        return { taxableValue: amount, taxAmount: 0, taxType: "NONE", taxRate: null };
    }

    const taxableValue = Math.round(amount / (1 + GST_RATE / 100));
    const taxAmount = amount - taxableValue;
    const taxType = state === SELLER_STATE ? "CGST_SGST" : "IGST";

    return { taxableValue, taxAmount, taxType, taxRate: GST_RATE };
}
