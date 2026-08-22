import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { ConsentService } from "@/modules/whatsapp/ConsentService";
import { TemplateGuard } from "@/modules/whatsapp/TemplateGuard";
import { prisma } from "@/lib/db";
import { withFeatureGuard } from "@/lib/flags/guard";
import { WhatsAppService } from "@/services/WhatsAppService";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { leadId, message, isTemplate } = body;

        if (!leadId || !message) {
            return NextResponse.json(
                { error: "leadId and message are required" },
                { status: 400 }
            );
        }

        // Retrieve Team ID and Phone for Feature Flag Check and Delivery
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { teamId: true, phone: true }
        });

        if (!lead || !lead.teamId) {
            return NextResponse.json({ error: "Lead or Team not found" }, { status: 404 });
        }

        const phone = lead.phone || body.recipientPhone;
        if (!phone) {
            return NextResponse.json({ error: "Lead has no phone number associated" }, { status: 400 });
        }

        // Feature Guard: Strict Execution Check
        await withFeatureGuard("whatsapp_outbound", { teamId: lead.teamId }, async () => {
            // Step 1: Validate Consent (DPDP Act 2023)
            const consentCheck = await ConsentService.validateConsent(leadId);

            if (!consentCheck.hasConsent) {
                throw new Error(`Consent Violation: ${consentCheck.reason}`);
            }

            // Step 2: Validate Template Compliance
            const templateCheck = await TemplateGuard.validateMessage(leadId, message, isTemplate);
            if (!templateCheck.isValid) {
                throw new Error(`Template Violation: ${templateCheck.reason}`);
            }

            // Step 3: Send via Service (Mock Supported)
            const sent = await WhatsAppService.sendMessage(leadId, message, isTemplate || false, phone);
            
            if (!sent) {
                throw new Error("Failed to send message via WhatsApp Service");
            }

            // Record in Database
            await TemplateGuard.recordMessageSent(leadId, message, isTemplate || false);
        });

        return NextResponse.json({
            success: true,
            status: "sent",
            compliance: { verified: true }
        });

    } catch (error: any) {
        // Specific Error Mapping for API Responses
        if (error.message.includes("Feature Access Denied")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("Consent Violation")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("Template Violation")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        logger.error("[WhatsApp Send] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}

// GET endpoint to check if a lead can receive WhatsApp messages
export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
        return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    try {
        const consentCheck = await ConsentService.validateConsent(leadId);
        const history = await ConsentService.getConsentHistory(leadId);

        return NextResponse.json({
            canMessage: consentCheck.hasConsent,
            reason: consentCheck.reason,
            consentHistory: history.map(log => ({
                action: log.action,
                timestamp: log.createdAt,
                metadata: log.metadata
            }))
        });

    } catch (error: any) {
        logger.error("[WhatsApp Check] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
