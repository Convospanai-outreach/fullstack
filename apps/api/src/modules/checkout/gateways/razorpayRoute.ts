import { razorpay, isRazorpayConfigured } from "@/lib/razorpay";

export { isRazorpayConfigured };

// `businessDetails` is passed straight through to Razorpay's Route "create
// linked account" API (POST /v2/accounts) rather than us guessing at which
// KYC fields matter - the caller (tenant onboarding UI) supplies whatever
// shape Razorpay's own docs require. A linked account created here still
// needs further activation (document upload, product configuration) via
// Razorpay before it can receive live transfers - see OPEN-52.
export async function createRazorpayLinkedAccount(
    businessDetails: Record<string, any>
): Promise<{ id: string; status?: string }> {
    if (!razorpay) throw new Error("Razorpay is not configured");
    const account = await razorpay.accounts.create(businessDetails as any);
    return { id: (account as any).id, status: (account as any).status };
}

export async function createRazorpayRouteOrder(params: {
    linkedAccountId: string;
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, any>;
}): Promise<{ id: string }> {
    if (!razorpay) throw new Error("Razorpay is not configured");
    const order = await razorpay.orders.create({
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
        transfers: [
            {
                account: params.linkedAccountId,
                amount: params.amount,
                currency: params.currency,
                on_hold: false,
            },
        ],
    } as any);
    return { id: order.id };
}
