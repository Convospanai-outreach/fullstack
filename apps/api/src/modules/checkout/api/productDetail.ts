import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { productService } from "../service/productService";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const body = await req.json().catch(() => ({}));
        const product = await productService.update(teamId, params.id, {
            name: typeof body?.name === "string" ? body.name.trim() : undefined,
            description: typeof body?.description === "string" ? body.description : undefined,
            priceAmount: Number.isFinite(Number(body?.priceAmount)) ? Math.round(Number(body.priceAmount)) : undefined,
            currency: typeof body?.currency === "string" ? body.currency : undefined,
            isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
        });
        if (!product) {
            throw new APIError("Product not found", 404);
        }
        return successResponse(product);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const deleted = await productService.delete(teamId, params.id);
        if (!deleted) {
            throw new APIError("Product not found", 404);
        }
        return successResponse({ ok: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
