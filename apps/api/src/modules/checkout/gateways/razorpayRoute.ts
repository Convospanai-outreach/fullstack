import { z } from "zod";
import { razorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { APIError } from "@/lib/apiResponse";

export { isRazorpayConfigured };

// Required fields match what the Connect Razorpay form sends and Razorpay's linked-account API
// needs; registered address and legal_info are optional because the form does not collect them.
// Extra documented KYC fields are passed through untouched.
const LinkedAccountSchema = z.object({
    email: z.string().email().max(254),
    phone: z.string().min(1).max(20).optional(),
    legal_business_name: z.string().min(1).max(200),
    business_type: z.enum(["individual", "proprietorship", "partnership", "private_limited", "public_limited", "llp", "ngo", "trust", "society", "not_yet_registered"]),
    profile: z.object({
        category: z.string().min(1).max(100),
        subcategory: z.string().min(1).max(100),
        addresses: z.object({
            registered: z.object({
                street1: z.string().max(200),
                street2: z.string().max(200).optional(),
                city: z.string().max(100),
                state: z.string().max(100),
                postal_code: z.string().max(10),
                country: z.string().length(2),
            }),
        }).optional(),
    }).passthrough(),
    legal_info: z.object({
        pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
        gst: z.string().max(20).optional(),
    }).passthrough().optional(),
}).passthrough();

// `businessDetails` is passed straight through to Razorpay's Route "create
// linked account" API (POST /v2/accounts) rather than us guessing at which
// KYC fields matter - the caller (tenant onboarding UI) supplies whatever
// shape Razorpay's own docs require. A linked account created here still
// needs further activation (document upload, product configuration) via
// Razorpay before it can receive live transfers - see OPEN-52.
export async function createRazorpayLinkedAccount(
    businessDetails: unknown
): Promise<{ id: string; status?: string }> {
    const parsed = LinkedAccountSchema.safeParse(businessDetails);
    if (!parsed.success) {
        throw new APIError(`Invalid linked account details: ${parsed.error.issues.map((i) => i.path.join(".") || "body").join(", ")}`, 400, "VALIDATION_ERROR");
    }
    if (!razorpay) throw new Error("Razorpay is not configured");
    const account = await razorpay.accounts.create(parsed.data as any);
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
