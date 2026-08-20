import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { productService } from "../service/productService";

// Public - lets a funnel's checkout page show the name/price before the
// buyer pays. Only ever resolves active products; never leaks teamId.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
    try {
        const product = await productService.getActiveById(params.id);
        if (!product) throw new APIError("Product not found", 404, "NOT_FOUND");

        return successResponse({
            id: product.id,
            name: product.name,
            description: product.description,
            priceAmount: product.priceAmount,
            currency: product.currency,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
