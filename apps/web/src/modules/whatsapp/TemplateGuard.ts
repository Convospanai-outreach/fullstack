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
     * Fetches from WhatsApp Business API using the configured system access token
     */
    static async getApprovedTemplates(_teamId: string): Promise<string[]> {
        const token = process.env['WHATSAPP_API_TOKEN'];
        const wabaId = process.env['WHATSAPP_WABA_ID']; // WhatsApp Business Account ID
        
        if (!token || !wabaId) {
            throw new Error("WhatsApp API credentials are not configured");
        }

        try {
            // Fetch real templates from the WhatsApp Cloud API
            const response = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/message_templates?status=APPROVED`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Extract the body text from the approved templates
            const templates: string[] = data.data
                .map((t: any) => {
                    const bodyComponent = t.components.find((c: any) => c.type === 'BODY');
                    return bodyComponent ? bodyComponent.text : null;
                })
                .filter(Boolean);

            if (templates.length === 0) {
                throw new Error("No approved WhatsApp templates returned");
            }

            return templates;
        } catch (error) {
            console.error("[TemplateGuard] Error fetching from WhatsApp API", error);
            throw error;
        }
    }

    /**
     * Record that a message was sent (for 24h window tracking)
     */
    static async recordMessageSent(leadId: string, message: string, _isTemplate: boolean) {
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
