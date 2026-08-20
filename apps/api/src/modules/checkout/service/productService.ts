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
        const existing = await this.getById(teamId, id);
        if (!existing) return null;
        return prisma.product.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.priceAmount !== undefined && { priceAmount: input.priceAmount }),
                ...(input.currency !== undefined && { currency: input.currency }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
        });
    }

    async delete(teamId: string, id: string) {
        const existing = await this.getById(teamId, id);
        if (!existing) return false;
        await prisma.product.delete({ where: { id } });
        return true;
    }
}

export const productService = new ProductService();
