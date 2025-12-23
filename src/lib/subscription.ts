import { prisma } from "@/lib/db";

const DAY_IN_MS = 86_400_000;

export const checkSubscription = async (userId: string) => {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: {
            status: true,
            currentPeriodEnd: true,
        },
    });

    if (!subscription) return false;

    const isValid =
        subscription.status === "active" &&
        subscription.currentPeriodEnd.getTime() + DAY_IN_MS > Date.now();

    return !!isValid;
};
