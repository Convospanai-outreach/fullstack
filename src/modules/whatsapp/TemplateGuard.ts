/**
 * WhatsApp Template Guard
 * 
 * Enforces WhatsApp Business API template compliance rules:
 * 1. First message to a user must use a pre-approved template
 * 2. Free-form messaging only allowed within 24h of last user reply
 * 3. No promotional content in template messages (policy violation)
 */

export interface TemplateValidation {
    isValid: boolean;
    reason?: string;
    requiresTemplate: boolean;
}

export class TemplateGuard {

    /**
     * Validates if a message can be sent based on WhatsApp Business API rules
     */
    static async validateMessage(
        leadId: string,
        message: string,
        isTemplate: boolean = false
    ): Promise<TemplateValidation> {

        const { prisma } = await import("@/lib/db");

        // Get last inbound message from this lead
        const lastInbound = await prisma.whatsAppMessage.findFirst({
            where: {
                leadId,
                direction: "INBOUND"
            },
            orderBy: { createdAt: "desc" }
        });

        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // If no previous conversation, MUST use template
        if (!lastInbound) {
            if (!isTemplate) {
                return {
                    isValid: false,
                    reason: "First message must use approved template",
                    requiresTemplate: true
                };
            }

            // Validate template content (no promotional language)
            const templateValidation = this.validateTemplateContent(message);
            if (!templateValidation.isValid) {
                return templateValidation;
            }

            return { isValid: true, requiresTemplate: true };
        }

        // Check if within 24h window
        const timeSinceLastReply = now - lastInbound.createdAt.getTime();
        const within24h = timeSinceLastReply < twentyFourHours;

        if (!within24h) {
            // Outside 24h window - must use template
            if (!isTemplate) {
                return {
                    isValid: false,
                    reason: "Outside 24h window - template required",
                    requiresTemplate: true
                };
            }

            const templateValidation = this.validateTemplateContent(message);
            if (!templateValidation.isValid) {
                return templateValidation;
            }
        }

        // Within 24h window - free-form allowed
        return { isValid: true, requiresTemplate: false };
    }

    /**
     * Validates template content for policy compliance
     * Templates cannot contain promotional language unless pre-approved
     */
    private static validateTemplateContent(message: string): TemplateValidation {
        // Basic heuristic: Check for promotional keywords
        const promotionalPatterns = [
            /discount/i,
            /special offer/i,
            /limited time/i,
            /buy now/i,
            /sale/i,
            /% off/i
        ];

        for (const pattern of promotionalPatterns) {
            if (pattern.test(message)) {
                return {
                    isValid: false,
                    reason: "Template contains promotional language - requires pre-approval",
                    requiresTemplate: true
                };
            }
        }

        // Template looks compliant
        return { isValid: true, requiresTemplate: true };
    }

    /**
     * Get approved templates for the team
     * In production, these would be fetched from WhatsApp Business API
     */
    static async getApprovedTemplates(teamId: string): Promise<string[]> {
        // Stub: In real implementation, call WhatsApp API
        // For now, return common approved templates
        return [
            "Hello {{1}}, this is {{2}} from {{3}}. We received your inquiry and would like to schedule a call. Are you available?",
            "Hi {{1}}, thank you for your interest in {{2}}. Our team will reach out to discuss your requirements.",
            "Hello {{1}}, following up on our previous conversation about {{2}}. Let me know if you have any questions."
        ];
    }

    /**
     * Record that a message was sent (for 24h window tracking)
     */
    static async recordMessageSent(leadId: string, message: string, isTemplate: boolean) {
        const { prisma } = await import("@/lib/db");

        await prisma.whatsAppMessage.create({
            data: {
                leadId,
                body: message,
                direction: "OUTBOUND",
                status: "sent"
            }
        });
    }
}
