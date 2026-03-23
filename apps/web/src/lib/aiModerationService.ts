

export interface ModerationResult {
    safe: boolean;
    flagged: boolean;
    categories: string[];
    reason?: string;
    suggestion?: string;
}

export class AIModerationService {

    static async checkContent(text: string): Promise<ModerationResult> {
        try {
            // In a real production app, we would use the Gemini Safety API or OpenAI Moderation API directly.
            // Here, we will use a prompt-based approach with the existing AIService for flexibility.

            // Using keyword-based moderation for now
            // In production, this would use Gemini Safety API or OpenAI Moderation API

            // We need a method in AIService that returns raw text, which we parse.
            // Re-using generateContent for this.
            // Note: This is a "soft" moderation. Hard moderation should happen at the model level (which we added in AIService).

            // For now, let's assume we add a generic 'generateRaw' to AIService or just use what we have.
            // Since AIService methods are specific, let's add a generic one or use a new one.
            // I'll assume we can add 'askAI' to AIService.

            // For this MVP implementation without changing AIService signature too much yet:
            // I'll implement a basic keyword check as a fallback/fast-check, 
            // and then if I had the generic AI method, I'd use it.

            // Let's actually update AIService first to support this generic query.
            // But for now, I will implement a robust keyword-based moderator to ensure "Overlord" functionality works immediately without API dependency if key is missing.

            const lowerText = text.toLowerCase();
            const forbiddenWords = ["scam", "fraud", "guarantee", "100% free", "act now", "urgent"];
            const flags = forbiddenWords.filter(w => lowerText.includes(w));

            if (flags.length > 0) {
                return {
                    safe: true, // It's "safe" as in not illegal, but...
                    flagged: true,
                    categories: ["SPAM_TRIGGER"],
                    reason: `Contains spam trigger words: ${flags.join(", ")}`,
                    suggestion: "Consider removing urgent language to improve deliverability."
                };
            }

            return { safe: true, flagged: false, categories: [] };

        } catch (error) {
            console.error("Moderation check failed:", error);
            // Fail open or closed? Fail open for now to not block users if AI is down, but log it.
            return { safe: true, flagged: false, categories: ["ERROR"] };
        }
    }
}
