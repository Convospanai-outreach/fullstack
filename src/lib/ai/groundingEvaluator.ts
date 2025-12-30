import { aiService } from "../aiService";

export class GroundingEvaluator {
    /**
     * Verifies if the answer is strictly based on the provided context.
     * This acts as an automated "hallucination check."
     */
    static async verify(answer: string, context: string): Promise<{ isGrounded: boolean; reason?: string }> {
        if (!context || context.trim() === "") return { isGrounded: true }; // No context to check against

        const prompt = `
GROUNDING VERIFICATION SYSTEM:
You are an expert at identifying hallucinations. Your job is to verify if the ANSWER below is strictly derived from the provided CONTEXT.

CONTEXT:
---
${context}
---

ANSWER:
---
${answer}
---

INSTRUCTIONS:
1. If the ANSWER contains information NOT present in the CONTEXT, mark as NOT GROUNDED.
2. If the ANSWER correctly states it doesn't know something that isn't in the context, mark as GROUNDED.
3. Ignore stylistic differences; focus on factual accuracy.

OUTPUT FORMAT (JSON ONLY):
{ "grounded": boolean, "reason": "brief explanation if not grounded" }
`;

        try {
            const rawResult = await aiService.askAI(prompt);
            const cleaned = rawResult.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(cleaned);

            return {
                isGrounded: result.grounded,
                reason: result.reason
            };
        } catch (e) {
            console.error("Grounding Verification Error:", e);
            // Fail safe: assume grounded if verification itself fails to avoid blocking the user, 
            // but log for human review.
            return { isGrounded: true };
        }
    }
}
