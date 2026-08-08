// import "server-only";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

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
        connectionTimeoutMillis: 15_000,
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
            },
            message: {
                async create({ args, query }) {
                    // Strict Invariant: Messages must belong to a thread
                    const data = args.data;
                    const hasThreadId = 'conversationThreadId' in data && data.conversationThreadId;
                    const hasThreadConnect = 'thread' in data && data.thread;

                    if (!hasThreadId && !hasThreadConnect) {
                        throw new Error("Invariant Violation: Message must belong to a ConversationThread.");
                    }
                    return query(args);
                }
            }
        }
    });

    return client;
};

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientInstance | undefined;
};

export function getPrisma() {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }

    return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientInstance, {
    get(_target, prop) {
        const client = getPrisma();
        const value = Reflect.get(client, prop, client);
        return typeof value === "function" ? value.bind(client) : value;
    },
});

export type { Prisma };
