import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { prisma } from "@/lib/db";

// Global cache for Prisma clients to prevent connection exhaustion in serverless/dev
const globalForPrisma = globalThis as unknown as {
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
        return prisma as unknown as PrismaClient;
    }

    private static getUaeClient(): PrismaClient {
        const uaeUrl = process.env['UAE_DATABASE_URL'];

        if (!uaeUrl) {
            throw new Error("CRITICAL_COMPLIANCE_ERROR: UAE_DATABASE_URL is not set. Data residency requirements cannot be met for UAE region.");
        }

        if (!globalForPrisma.prismaUAE) {
            const adapter = this.createAdapter(uaeUrl);
            const options: any = { datasources: { db: { url: uaeUrl } }, adapter };
            globalForPrisma.prismaUAE = new PrismaClient(options);
        }
        return globalForPrisma.prismaUAE;
    }

    private static getEuClient(): PrismaClient {
        const euUrl = process.env['EU_DATABASE_URL'];

        if (!euUrl) {
            if (process.env['EU_ALLOW_GLOBAL_FALLBACK'] === 'true') {
                console.warn("⚠️ EU_DATABASE_URL is not set. Falling back to Global DB (Data Residency Risk).");
                return this.getGlobalClient();
            }
            throw new Error("CRITICAL_COMPLIANCE_ERROR: EU_DATABASE_URL is not set. GDPR data residency requirements cannot be met for EU region.");
        }

        if (!globalForPrisma.prismaEU) {
            const adapter = this.createAdapter(euUrl);
            const options: any = { datasources: { db: { url: euUrl } }, adapter };
            globalForPrisma.prismaEU = new PrismaClient(options);
        }
        return globalForPrisma.prismaEU;
    }

    private static createAdapter(databaseUrl: string) {
        const pool = new Pool({
            connectionString: databaseUrl,
        });
        return new PrismaPg(pool as any);
    }
}
