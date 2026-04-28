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
        if (process.env['NODE_ENV'] === "production") {
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
            throw new Error("CRITICAL_COMPLIANCE_ERROR: UAE_DATABASE_URL is not set. Data residency requirements cannot be met for UAE region.");
        }

        const adapter = this.createAdapter(uaeUrl);
        if (process.env['NODE_ENV'] === "production") {
            const options: any = { datasources: { db: { url: uaeUrl } }, adapter };
            return new PrismaClient(options);
        }

        if (!globalForPrisma.prismaUAE) {
            const options: any = { datasources: { db: { url: uaeUrl } }, adapter };
            globalForPrisma.prismaUAE = new PrismaClient(options);
        }
        return globalForPrisma.prismaUAE;
    }

    private static getEuClient(): PrismaClient {
        const euUrl = process.env['EU_DATABASE_URL'];

        if (!euUrl) {
            console.warn("⚠️ EU_DATABASE_URL is not set. Falling back to Global DB (Data Residency Risk).");
            return this.getGlobalClient();
        }

        const adapter = this.createAdapter(euUrl);
        if (process.env['NODE_ENV'] === "production") {
            const options: any = { datasources: { db: { url: euUrl } }, adapter };
            return new PrismaClient(options);
        }

        if (!globalForPrisma.prismaEU) {
            const options: any = { datasources: { db: { url: euUrl } }, adapter };
            globalForPrisma.prismaEU = new PrismaClient(options);
        }
        return globalForPrisma.prismaEU;
    }

    private static createAdapter(databaseUrl: string) {
        const { Pool } = require("pg");
        const { PrismaPg } = require("@prisma/adapter-pg");
        const pool = new Pool({
            connectionString: databaseUrl,
        });
        return new PrismaPg(pool);
    }
}
