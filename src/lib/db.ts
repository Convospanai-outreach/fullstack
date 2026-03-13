// import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const createPrismaClient = () => {
    const client = new PrismaClient({
        log: ["error"],
    }).$extends({
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== "production") {
    globalForPrisma.prisma = prisma;
}
