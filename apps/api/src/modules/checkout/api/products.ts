import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { productService } from "../service/productService";

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        const products = await productService.list(teamId);
        return successResponse(products);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const body = await req.json().catch(() => ({}));
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const priceAmount = Number(body?.priceAmount);
        if (!name || !Number.isFinite(priceAmount) || priceAmount <= 0) {
            throw new APIError("name and a positive priceAmount are required", 400, "VALIDATION_ERROR");
        }

        const product = await productService.create(teamId, {
            name,
            description: typeof body?.description === "string" ? body.description : undefined,
            priceAmount: Math.round(priceAmount),
            currency: typeof body?.currency === "string" ? body.currency : undefined,
            isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
        });
        return successResponse(product, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
