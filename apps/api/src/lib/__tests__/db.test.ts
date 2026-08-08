import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { extensionHooks, messageCreate, transaction } = vi.hoisted(() => {
    const messageCreate = vi.fn(async (args: unknown) => ({ args }));
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        message: { create: messageCreate },
    }));
    return { extensionHooks: [] as any[], messageCreate, transaction };
});

vi.mock("@prisma/client", () => ({
    PrismaClient: class PrismaClient {
        $extends(extension: unknown) {
            extensionHooks.push(extension);
            return {
                message: { create: messageCreate },
                $transaction: transaction,
            };
        }
    },
}));

describe("Prisma client extensions", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        extensionHooks.length = 0;
        delete (globalThis as { prisma?: unknown }).prisma;
        vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete (globalThis as { prisma?: unknown }).prisma;
    });

    it("allows ordinary and interactive Message.create while retaining the query extension", async () => {
        const { prisma } = await import("../db");

        await expect((prisma as any).message.create({ data: { leadId: "lead-1", content: "inbound" } }))
            .resolves.toBeDefined();
        await expect((prisma as any).$transaction((tx: any) => tx.message.create({
            data: { leadId: "lead-1", content: "inbound" },
        }))).resolves.toBeDefined();

        expect(messageCreate).toHaveBeenCalledTimes(2);
        expect(extensionHooks).toHaveLength(1);
        expect(extensionHooks[0].query.$allOperations).toEqual(expect.any(Function));
        expect(extensionHooks[0].query.message).toBeUndefined();
    });
});
