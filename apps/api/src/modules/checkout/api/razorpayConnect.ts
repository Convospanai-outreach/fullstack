import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { createRazorpayLinkedAccount } from "../gateways/razorpayRoute";
import { paymentAccountService } from "../service/paymentAccountService";

// Razorpay Route linked accounts require Route-specific KYC fields Razorpay's
// own docs define (legal_business_name, business_type, contact, profile,
// legal_info, ...) - passed straight through from the caller's body rather
// than guessed at here. A created account still needs document upload /
// activation via Razorpay before it can receive live transfers; status is
// stored as whatever Razorpay returns, not assumed ACTIVE.
export async function connect(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const businessDetails = await req.json().catch(() => null);
        if (!businessDetails || typeof businessDetails !== "object") {
            throw new APIError("Business details are required", 400, "VALIDATION_ERROR");
        }

        const account = await createRazorpayLinkedAccount(businessDetails);
        const record = await paymentAccountService.upsert(teamId, "RAZORPAY", {
            externalAccountId: account.id,
            status: account.status === "activated" ? "ACTIVE" : "PENDING",
            metadata: { razorpayStatus: account.status },
        });

        return successResponse({
            gateway: "RAZORPAY",
            status: record.status,
            connected: true,
        }, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
