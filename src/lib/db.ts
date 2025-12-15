import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
    try {
        return globalForPrisma.prisma ||
            new PrismaClient({
                log: ["query", "info", "warn", "error"],
            });
    } catch (e) {
        console.error("Failed to initialize Prisma Client", e);
        console.error("Environment:", {
            NODE_ENV: process.env.NODE_ENV,
            PRISMA_CLIENT_ENGINE_TYPE: process.env.PRISMA_CLIENT_ENGINE_TYPE,
        });
        throw e;
    }
})();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
