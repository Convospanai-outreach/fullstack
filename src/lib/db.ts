import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const createPrismaClient = () => {
    return new PrismaClient({
        log: ["error"],
    }).$extends({
        query: {
            message: {
                async create({ args, query }) {
                    // Strict Invariant: Messages must belong to a thread
                    // Cast to any to avoid complex union type checks for 'conversationThreadId'
                    const data = args.data as any;
                    const hasThreadId = data.conversationThreadId;
                    const hasThreadConnect = data.thread;

                    if (!hasThreadId && !hasThreadConnect) {
                        throw new Error("Invariant Violation: Message must belong to a ConversationThread.");
                    }
                    return query(args);
                }
            }
        }
    });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
