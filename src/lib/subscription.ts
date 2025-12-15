import { prisma } from "@/lib/db";

const DAY_IN_MS = 86_400_000;

export const checkSubscription = async (teamId: string) => {
    const subscription = await prisma.subscription.findUnique({
        where: { teamId },
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

export const checkCredits = async (teamId: string, cost: number = 1) => {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { credits: true }
    });

    if (!team) return false;

    return team.credits >= cost;
};

export const deductCredits = async (teamId: string, cost: number = 1) => {
    await prisma.team.update({
        where: { id: teamId },
        data: { credits: { decrement: cost } }
    });
};
