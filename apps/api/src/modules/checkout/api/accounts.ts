import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { paymentAccountService } from "../service/paymentAccountService";

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        const accounts = await paymentAccountService.list(teamId);
        return successResponse(
            accounts.map((a) => ({
                gateway: a.gateway,
                status: a.status,
                connected: Boolean(a.externalAccountId),
                createdAt: a.createdAt,
            }))
        );
    } catch (error) {
        return handleAPIError(error);
    }
}
