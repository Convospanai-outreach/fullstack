import { prisma } from "@/lib/db";

export interface ValidationResult {
    isSafe: boolean;
    violations: Violation[];
}

export interface Violation {
    type: 'PII' | 'KEYWORD' | 'REGEX' | 'COMPETITOR' | 'TOXICITY';
    reason: string;
    snippet: string;
}

const PII_REGEX = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    PHONE: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    // SSN, Credit Card could be added here
};

export class GuardrailService {

    /**
     * Evaluates content against a specific team's policy.
     */
    async evaluate(teamId: string, content: string): Promise<ValidationResult> {
        const policy = await prisma.guardrailPolicy.findUnique({
            where: { teamId }
        }) as any;

        // Default safe if no policy exists (or fail-safe depending on requirements)
        // For now, fail-open but log warning (omitted for brevity)
        if (!policy) {
            return { isSafe: true, violations: [] };
        }

        const violations: Violation[] = [];

        // 1. PII Detection
        if (policy.detectPII) {
            if (PII_REGEX.EMAIL.test(content)) {
                const matches = content.match(PII_REGEX.EMAIL) || [];
                violations.push({
                    type: 'PII',
                    reason: 'Email address detected',
                    snippet: matches[0] || "" // Only store first match for privacy
                });
            }
            if (PII_REGEX.PHONE.test(content)) {
                const matches = content.match(PII_REGEX.PHONE) || [];
                violations.push({
                    type: 'PII',
                    reason: 'Phone number detected',
                    snippet: matches[0] || ""
                });
            }
        }

        // 2. Blocklist (Keywords)
        if (policy.blocklist && policy.blocklist.length > 0) {
            const lowerContent = content.toLowerCase();
            for (const word of policy.blocklist) {
                if (lowerContent.includes(word.toLowerCase())) {
                    violations.push({
                        type: 'KEYWORD',
                        reason: `Blocked keyword found: ${word}`,
                        snippet: word
                    });
                }
            }
        }

        // 3. Competitor Mentions
        if (policy.competitorMentions && policy.competitorMentions.length > 0) {
            const lowerContent = content.toLowerCase();
            for (const competitor of policy.competitorMentions) {
                if (lowerContent.includes(competitor.toLowerCase())) {
                    violations.push({
                        type: 'COMPETITOR',
                        reason: `Competitor mentioned: ${competitor}`,
                        snippet: competitor
                    });
                }
            }
        }

        // 4. Custom Regex Rules
        if (policy.regexRules && policy.regexRules.length > 0) {
            for (const pattern of policy.regexRules) {
                try {
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(content)) {
                        violations.push({
                            type: 'REGEX',
                            reason: `Custom pattern matched: ${pattern}`,
                            snippet: content.match(regex)?.[0] || pattern || ""
                        });
                    }
                } catch (e) {
                    console.error("Invalid regex in policy:", pattern);
                }
            }
        }

        // Log violations if any
        if (violations.length > 0) {
            await this.logViolation(teamId, content, violations[0]!); // Log primary violation
        }

        return {
            isSafe: violations.length === 0,
            violations
        };
    }

    private async logViolation(teamId: string, content: string, violation: Violation) {
        await prisma.guardrailLog.create({
            data: {
                teamId,
                action: 'blocked',
                violationType: violation.type,
                reason: violation.reason,
                content: content.substring(0, 1000), // Truncate for storage
                metadata: { snippet: violation.snippet }
            }
        });
    }
}

export const guardrailService = new GuardrailService();
