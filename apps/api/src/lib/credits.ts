import { prisma } from "@/lib/db";

/**
 * Checks if a team has enough credits for an operation.
 */
export async function checkCredits(teamId: string, amount: number): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Credit check amount must be a positive number");
    }
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { credits: true }
    });

    if (!team) return false;
    return team.credits >= amount;
}

/**
 * Deducts credits from a team and records the transaction.
 * @returns true if successful, false if insufficient credits
 */
export async function deductCredits(
    teamId: string,
    amount: number,
    description: string,
    meta?: any
): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Deduct amount must be a positive number");
    }
    return await prisma.$transaction(async (tx) => {
        const team = await tx.team.findUnique({
            where: { id: teamId },
            select: { credits: true }
        });

        if (!team || team.credits < amount) {
            return false;
        }

        // Deduct credits
        await tx.team.update({
            where: { id: teamId },
            data: { credits: { decrement: amount } }
        });

        // Record transaction (negative amount for usage)
        await tx.creditTransaction.create({
            data: {
                teamId,
                amount: -amount,
                description,
                type: "usage",
                meta: meta || {}
            }
        });

        return true;
    });
}

/**
 * Adds credits to a team (e.g. from top-up).
 */
export async function addCredits(
    teamId: string,
    amount: number,
    description: string,
    meta?: any
): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Add amount must be a positive number");
    }
    await prisma.$transaction([
        prisma.team.update({
            where: { id: teamId },
            data: { credits: { increment: amount } }
        }),
        prisma.creditTransaction.create({
            data: {
                teamId,
                amount,
                description,
                type: "topup",
                meta: meta || {}
            }
        })
    ]);
}
