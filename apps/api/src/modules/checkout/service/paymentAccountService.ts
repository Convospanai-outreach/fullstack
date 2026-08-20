import { prisma } from "@/lib/db";

export type Gateway = "STRIPE" | "RAZORPAY";

class PaymentAccountService {
    async list(teamId: string) {
        return prisma.paymentAccount.findMany({ where: { teamId } });
    }

    async getActive(teamId: string, gateway: Gateway) {
        return prisma.paymentAccount.findFirst({
            where: { teamId, gateway, status: "ACTIVE" },
        });
    }

    async upsert(teamId: string, gateway: Gateway, data: {
        externalAccountId: string;
        status?: string;
        metadata?: Record<string, any>;
    }) {
        return prisma.paymentAccount.upsert({
            where: { teamId_gateway: { teamId, gateway } },
            update: {
                externalAccountId: data.externalAccountId,
                status: data.status ?? "ACTIVE",
                metadata: data.metadata,
            },
            create: {
                teamId,
                gateway,
                externalAccountId: data.externalAccountId,
                status: data.status ?? "ACTIVE",
                metadata: data.metadata,
            },
        });
    }
}

export const paymentAccountService = new PaymentAccountService();
