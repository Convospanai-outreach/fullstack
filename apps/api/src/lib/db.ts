// import "server-only";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const createPrismaClient = () => {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set.");
    }

    const resolvedDatabaseUrl =
        process.env["NODE_ENV"] === "production"
            ? databaseUrl
            : databaseUrl.replace("@localhost:", "@127.0.0.1:");

    const { Pool } = require("pg");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({
        connectionString: resolvedDatabaseUrl,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });
    const adapter = new PrismaPg(pool);

    const options: any = { log: ["error"], adapter };

    const client = new PrismaClient(options).$extends({
        query: {
            $allOperations({ model: _model, operation: _operation, args, query }) {
                try {
                    const { RequestContext } = require('./requestContext');
                    const correlationId = RequestContext.getCorrelationId();
                    if (correlationId) {
                        // Prisma doesn't directly support query comments in $extends yet 
                        // in a way that's totally transparent for all ops, but we can log it 
                        // or wait for official support.
                        // However, we can use $on('query') if we use the constructor.
                        // For now, we'll use a custom log for slow queries with cid.
                    }
                } catch (e) {}
                return query(args);
            }
        }
    });

    return client;
};

// Deferred behind a Proxy so `createPrismaClient()` (which reads DATABASE_URL and throws
// if it's unset) only runs on first actual use, not at module-import time. Some entry
// points (e.g. apps/api/server.ts) statically import modules that transitively import this
// file before their own dotenv.config() call has run, which would otherwise crash on boot.
let cachedClient: ReturnType<typeof createPrismaClient> | undefined = globalForPrisma.prisma;

function getPrismaClient() {
    if (!cachedClient) {
        cachedClient = createPrismaClient();
        if (process.env['NODE_ENV'] !== "production") {
            globalForPrisma.prisma = cachedClient;
        }
    }
    return cachedClient;
}

export const prisma = new Proxy({} as ReturnType<typeof createPrismaClient>, {
    get(_target, prop, _receiver) {
        const client = getPrismaClient() as any;
        const value = client[prop];
        return typeof value === "function" ? value.bind(client) : value;
    },
}) as ReturnType<typeof createPrismaClient>;

// `prisma` is wrapped in $extends(...) above, so its $transaction callback
// receives an extended client whose type doesn't structurally match the
// plain Prisma.TransactionClient from @prisma/client. Derive the type from
// the actual exported client instead of the generic one.
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
