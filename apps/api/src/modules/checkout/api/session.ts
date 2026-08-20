import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { checkoutService } from "../service/checkoutService";

// Public - called from a tenant's own funnel/checkout page, not from an
// authenticated dashboard session. No team auth here by design; the seller
// is resolved from the (public, active-only) Product, not from the caller.
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const productId = typeof body?.productId === "string" ? body.productId : "";
        const gateway = body?.gateway === "STRIPE" || body?.gateway === "RAZORPAY" ? body.gateway : null;
        if (!productId || !gateway) {
            throw new APIError("productId and gateway (STRIPE|RAZORPAY) are required", 400, "VALIDATION_ERROR");
        }

        const session = await checkoutService.createSession({
            productId,
            gateway,
            customerEmail: typeof body?.customerEmail === "string" ? body.customerEmail : undefined,
            customerName: typeof body?.customerName === "string" ? body.customerName : undefined,
            landingPageSlug: typeof body?.landingPageSlug === "string" ? body.landingPageSlug : undefined,
        });

        return successResponse(session, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
