import { prisma } from "@/lib/db";

interface ProductInput {
    name: string;
    description?: string;
    priceAmount: number;
    currency?: string;
    isActive?: boolean;
}

class ProductService {
    async create(teamId: string, input: ProductInput) {
        return prisma.product.create({
            data: {
                teamId,
                name: input.name,
                description: input.description ?? null,
                priceAmount: input.priceAmount,
                currency: input.currency || "USD",
                isActive: input.isActive ?? true,
            },
        });
    }

    async list(teamId: string) {
        return prisma.product.findMany({ where: { teamId }, orderBy: { createdAt: "desc" } });
    }

    async getById(teamId: string, id: string) {
        return prisma.product.findFirst({ where: { id, teamId } });
    }

    // Public read used by the checkout session route - only ever returns an
    // active product, and never leaks which team it belongs to beyond what's
    // needed to resolve the seller's connected payment account.
    async getActiveById(id: string) {
        return prisma.product.findFirst({ where: { id, isActive: true } });
    }

    async update(teamId: string, id: string, input: Partial<ProductInput>) {
        // Scoped by teamId here too, not just in getById()'s pre-check - the mutation's
        // own safety must not depend solely on a separate pre-check holding true (same
        // anti-pattern already fixed under OPEN-99/109/110/118/120). Product has no
        // compound unique on (id, teamId), so updateMany() is used instead of update().
        const updated = await prisma.product.updateMany({
            where: { id, teamId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.priceAmount !== undefined && { priceAmount: input.priceAmount }),
                ...(input.currency !== undefined && { currency: input.currency }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
        });
        if (updated.count === 0) return null;
        return this.getById(teamId, id);
    }

    async delete(teamId: string, id: string) {
        // Same reasoning as update() above - deleteMany() scoped by teamId instead of
        // relying solely on the pre-check.
        const deleted = await prisma.product.deleteMany({ where: { id, teamId } });
        return deleted.count > 0;
    }
}

export const productService = new ProductService();
