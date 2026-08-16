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
        // Atomic conditional decrement prevents check-then-update races.
        const updated = await tx.team.updateMany({
            where: {
                id: teamId,
                credits: { gte: amount }
            },
            data: { credits: { decrement: amount } }
        });

        if (updated.count !== 1) {
            return false;
        }

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
 *
 * If `meta.paymentId` is set, the grant is atomic against concurrent or
 * retried callers for the same payment: the unique constraint on
 * CreditTransaction.paymentId rejects a duplicate insert, and since both
 * statements run in one transaction, the team's credit increment rolls back
 * with it. Returns `granted: false` (instead of throwing) when this happens,
 * so a caller can treat it the same as "already processed".
 *
 * `amount` of 0 is allowed: a zero-credit plan still needs the atomic
 * paymentId reservation above to guard whatever it gates (e.g. a
 * subscription renewal) against the same concurrent-delivery race.
 */
export async function addCredits(
    teamId: string,
    amount: number,
    description: string,
    meta?: any,
    type: string = "topup"
): Promise<{ granted: boolean }> {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Add amount must not be negative");
    }
    try {
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
                    type,
                    meta: meta || {},
                    paymentId: meta?.paymentId ?? null
                }
            })
        ]);
        return { granted: true };
    } catch (error: any) {
        if (error?.code === "P2002") {
            return { granted: false };
        }
        throw error;
    }
}

/**
 * Refunds credits to a team.
 */
export async function refundCredits(
    teamId: string,
    amount: number,
    description: string,
    meta?: any
): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Refund amount must be a positive number");
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
                type: "refund",
                meta: meta || {}
            }
        })
    ]);
}
