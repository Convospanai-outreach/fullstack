
import { prisma } from "@/lib/db";
import { ModelRequest } from "@/ai/types";
import { contextBundler } from "./ContextBundler";

export class TokenUsageGuard {
    // Estimated cost per 1k tokens (Average blend)

    /**
     * Checks if the request allows for generation based on team/user quotas.
     * Returns an optimized request or throws an error if quota exceeded.
     */
    async guard(request: ModelRequest): Promise<ModelRequest> {
        if (!request.teamId) return request; // Skip if no team context (system tasks)

        // 1. Fetch Team and Subscription Status
        const team = await prisma.team.findUnique({
            where: { id: request.teamId }
        });

        // Use the credits field on Team model based on schema
        // Schema says: credits Int @default(100)
        const currentCredits = team?.credits || 0;

        // 2. Estimate Cost of this Request
        const estInputTokens = Math.ceil(request.prompt.length / 4);
        const estOutputTokens = request.maxTokens || 500;

        // Simple Credit Calculation: 1 Credit = 1k tokens (Approx)
        const estCreditsNeeded = Math.ceil((estInputTokens + estOutputTokens) / 1000);

        // 3. Check Quota
        if (currentCredits < estCreditsNeeded) {
            console.warn(`[TokenUsageGuard] Team ${request.teamId} out of credits. Needed: ${estCreditsNeeded}, Has: ${currentCredits}`);
            throw new Error("Insufficient credits. Please upgrade your plan or top up.");
        }

        // 4. Optimize if low on credits (e.g., < 100 credits left)
        if (currentCredits < 100 && request.complexity !== "STRATEGIC") {
            console.log("[TokenUsageGuard] Low credits detected. Optimizing context...");
            return await contextBundler.optimizeContext(request);
        }

        return request;
    }

    /**
     * Deducts credits after a successful generation.
     */
    async deduct(teamId: string, tokensIn: number, tokensOut: number) {
        // 1 Credit = 1000 Tokens (blended)
        const creditsUsed = Math.ceil((tokensIn + tokensOut) / 1000);

        if (creditsUsed > 0) {
            await prisma.team.update({
                where: { id: teamId },
                data: {
                    credits: {
                        decrement: creditsUsed
                    }
                }
            });

            // Log transaction
            await prisma.creditTransaction.create({
                data: {
                    teamId,
                    amount: -creditsUsed,
                    description: "AI Generation Usage",
                    type: "usage"
                }
            });
        }
    }
}

export const tokenUsageGuard = new TokenUsageGuard();
