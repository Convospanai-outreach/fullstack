import { prisma } from "@/lib/db";

interface ValidationResult {
    valid: boolean;
    reason?: string;
    action?: 'BLOCK' | 'FLAG';
}

export class GuardrailService {

    // Simple PII Regex Patterns
    private static PII_PATTERNS = {
        CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/,
        SSN: /\b\d{3}-\d{2}-\d{4}\b/,
        // Add more as needed
    };

    /**
     * Validates content against a team's guardrail policy.
     */
    async validateMessage(teamId: string, userId: string, content: string): Promise<ValidationResult> {
        // 1. Fetch Policy
        const policy = await prisma.guardrailPolicy.findUnique({
            where: { teamId }
        });

        // Default: If no policy, assume safe (or restrictive? safe for now)
        if (!policy) return { valid: true };

        const violations: string[] = [];

        // 2. Check Blocklist
        if (policy.blocklist && policy.blocklist.length > 0) {
            const lowerContent = content.toLowerCase();
            for (const word of policy.blocklist) {
                if (lowerContent.includes(word.toLowerCase())) {
                    await this.logViolation(teamId, userId, "keyword_blocked", `Contains blocked word: ${word}`);
                    return { valid: false, reason: `Message contains blocked keyword: ${word}`, action: 'BLOCK' };
                }
            }
        }

        // 3. Check PII
        if (policy.detectPII) {
            if (GuardrailService.PII_PATTERNS.CREDIT_CARD.test(content)) {
                await this.logViolation(teamId, userId, "pii_detected", "Potential Credit Card Number detected");
                return { valid: false, reason: "Message contains potential PII (Credit Card)", action: 'BLOCK' };
            }
            if (GuardrailService.PII_PATTERNS.SSN.test(content)) {
                await this.logViolation(teamId, userId, "pii_detected", "Potential SSN detected");
                return { valid: false, reason: "Message contains potential PII (SSN)", action: 'BLOCK' };
            }
        }

        // 4. Check Tone (Placeholder for future AI eval)
        // if (policy.strictness === 'high') { ... }

        return { valid: true };
    }

    private async logViolation(teamId: string, userId: string, reason: string, contentSnippet: string) {
        await prisma.guardrailLog.create({
            data: {
                teamId,
                userId,
                action: 'blocked',
                reason,
                content: contentSnippet
            }
        });
    }
}

export const guardrailService = new GuardrailService();
