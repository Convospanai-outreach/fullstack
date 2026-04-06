import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";

export interface ComplianceResult {
    isCompliant: boolean;
    reason?: string;
    violations: string[];
}

export class ComplianceEvaluator {
    private static PII_PATTERNS = {
        CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/,
        SSN: /\b\d{3}-\d{2}-\d{4}\b/,
        EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        PHONE: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,
    };

    /**
     * Evaluates content against organization governance compliance settings.
     */
    static async evaluateCompliance(orgId: string, content: string): Promise<ComplianceResult> {
        const policy = await prisma.organizationPolicy.findUnique({
            where: { organizationId: orgId }
        });

        if (!policy) return { isCompliant: true, violations: [] };

        const violations: string[] = [];

        // 1. Keyword Blocking
        if (policy.blockedKeywords && policy.blockedKeywords.length > 0) {
            const lowerContent = content.toLowerCase();
            for (const word of policy.blockedKeywords) {
                if (lowerContent.includes(word.toLowerCase())) {
                    violations.push(`Blocked keyword detected: "${word}"`);
                }
            }
        }

        // 2. PII Detection
        if (policy.detectPII) {
            if (ComplianceEvaluator.PII_PATTERNS.CREDIT_CARD.test(content)) {
                violations.push("Potential Credit Card Number detected");
            }
            if (ComplianceEvaluator.PII_PATTERNS.SSN.test(content)) {
                violations.push("Potential SSN detected");
            }
            // For enterprise, we might also want to block emails/phones if strict
            if (ComplianceEvaluator.PII_PATTERNS.EMAIL.test(content)) {
                violations.push("PII detected: Email address");
            }
            if (ComplianceEvaluator.PII_PATTERNS.PHONE.test(content)) {
                violations.push("PII detected: Phone number");
            }
        }

        // 3. AI-Driven Tone & Compliance Check (Secondary)
        if (policy.restrictedTone && violations.length === 0) {
            try {
                const toneCheck = await ComplianceEvaluator.verifyToneWithAI(content, policy.restrictedTone);
                if (!toneCheck.isCompliant) {
                    violations.push(toneCheck.reason || "Tone compliance violation");
                }
            } catch (error) {
                console.error("[ComplianceEvaluator] AI tone check failed", error);
                // Fail-safe: don't block if AI check fails, unless strictly required
            }
        }

        return {
            isCompliant: violations.length === 0,
            violations,
            reason: violations.join("; ")
        };
    }

    private static async verifyToneWithAI(content: string, constraint: string): Promise<{ isCompliant: boolean, reason?: string }> {
        const prompt = `
            Task: Compliance Audit
            Role: Enterprise Compliance Officer
            
            Evaluate the following content against the provided CONSTRAINT.
            
            CONTENT:
            "${content}"
            
            CONSTRAINT:
            "${constraint}"
            
            Return JSON only:
            {
                "isCompliant": boolean,
                "reason": "string (required if non-compliant)"
            }
        `;

        try {
            const response = await aiService.askAI(prompt, undefined, { expectsJson: true, disableGuardrails: true });
            const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(cleaned);
            return result;
        } catch (e) {
            return { isCompliant: true }; // Fail-safe
        }
    }
}
