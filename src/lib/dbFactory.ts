
import { PrismaClient } from "@prisma/client";

// Global cache for Prisma clients to prevent connection exhaustion in serverless/dev
const globalForPrisma = globalThis as unknown as {
    prismaGlobal: PrismaClient | undefined;
    prismaUAE: PrismaClient | undefined;
    prismaEU: PrismaClient | undefined;
};

export class DbFactory {
    /**
     * Returns the appropriate Prisma Client based on the region specific sharding policy.
     * @param region 'GLOBAL' | 'UAE' | 'EU'
     */
    static getClient(region: 'GLOBAL' | 'UAE' | 'EU' = 'GLOBAL'): PrismaClient {
        if (region === 'UAE') {
            return this.getUaeClient();
        }
        if (region === 'EU') {
            return this.getEuClient();
        }
        return this.getGlobalClient();
    }

    private static getGlobalClient(): PrismaClient {
        if (process.env.NODE_ENV === "production") {
            return new PrismaClient();
        }
        if (!globalForPrisma.prismaGlobal) {
            globalForPrisma.prismaGlobal = new PrismaClient();
        }
        return globalForPrisma.prismaGlobal;
    }

    private static getUaeClient(): PrismaClient {
        const uaeUrl = process.env['UAE_DATABASE_URL'];

        if (!uaeUrl) {
            console.warn("⚠️ UAE_DATABASE_URL is not set. Falling back to Global DB (Data Residency Risk).");
            return this.getGlobalClient();
        }

        if (process.env.NODE_ENV === "production") {
            return new PrismaClient({
                datasources: { db: { url: uaeUrl } },
            });
        }

        if (!globalForPrisma.prismaUAE) {
            globalForPrisma.prismaUAE = new PrismaClient({
                datasources: { db: { url: uaeUrl } },
            });
        }
        return globalForPrisma.prismaUAE;
    }

    private static getEuClient(): PrismaClient {
        const euUrl = process.env['EU_DATABASE_URL'];

        if (!euUrl) {
            console.warn("⚠️ EU_DATABASE_URL is not set. Falling back to Global DB (Data Residency Risk).");
            return this.getGlobalClient();
        }

        if (process.env.NODE_ENV === "production") {
            return new PrismaClient({
                datasources: { db: { url: euUrl } },
            });
        }

        if (!globalForPrisma.prismaEU) {
            globalForPrisma.prismaEU = new PrismaClient({
                datasources: { db: { url: euUrl } },
            });
        }
        return globalForPrisma.prismaEU;
    }
}
