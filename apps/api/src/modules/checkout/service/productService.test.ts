import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        product: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { productService } from "./productService";

describe("productService - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("update", () => {
        it("scopes the actual update mutation by teamId, not just a pre-check", async () => {
            mockPrisma.product.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.product.findFirst.mockResolvedValue({ id: "product-1", teamId: "team-a", name: "New Name" });

            const result = await productService.update("team-a", "product-1", { name: "New Name" });

            expect(mockPrisma.product.updateMany).toHaveBeenCalledWith({
                where: { id: "product-1", teamId: "team-a" },
                data: { name: "New Name" },
            });
            expect(result).toEqual({ id: "product-1", teamId: "team-a", name: "New Name" });
        });

        it("returns null instead of updating a product that belongs to a different team", async () => {
            mockPrisma.product.updateMany.mockResolvedValue({ count: 0 });

            const result = await productService.update("team-a", "product-from-team-b", { name: "Hijacked" });

            expect(result).toBeNull();
            expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("scopes the actual delete mutation by teamId, not just a pre-check", async () => {
            mockPrisma.product.deleteMany.mockResolvedValue({ count: 1 });

            const result = await productService.delete("team-a", "product-1");

            expect(mockPrisma.product.deleteMany).toHaveBeenCalledWith({
                where: { id: "product-1", teamId: "team-a" },
            });
            expect(result).toBe(true);
        });

        it("returns false instead of deleting a product that belongs to a different team", async () => {
            mockPrisma.product.deleteMany.mockResolvedValue({ count: 0 });

            const result = await productService.delete("team-a", "product-from-team-b");

            expect(result).toBe(false);
        });
    });
});
