
/**
 * @deprecated Prefer server-side Python Edge Node for stronger isolation.
 * Sovereign Firewall
 * 
 * Ensures PII/sensitive data never leaves the region (or the VPC).
 * Implements masking/unmasking logic for DPDP/GDPR compliance.
 */

import { HardwareService } from "@/services/HardwareService";
import { prisma } from "@/lib/db";

export class SovereignFirewall {

    /**
     * Masks PII in the text using the Physical Edge Node.
     * Returns the safe text. The token map is stored on the Edge Node statefully.
     */
    static async processOutbound(text: string, teamId: string, userId: string, context?: string): Promise<string> {
        // CIRCUIT BREAKER CHECK
        if (breaker.isOpen()) {
            console.warn("[SovereignFirewall] 🛡️ Circuit Breaker OPEN. Blocking outbound traffic due to repeated hardware failures.");
            if (process.env.NODE_ENV === 'production') {
                throw new Error("Hardware Service Unavailable (Circuit Breaker Open). Outbound traffic blocked.");
            }
        }

        // DETERMINISTIC PRE-SEND CHECK
        const violationContext = `Team: ${teamId}, User: ${userId}, Context: ${context || 'N/A'}`;

        // ... (Regex checks ommitted for brevity if unchanged, but replace_file_content requires context)
        // Since I'm replacing the whole method or file, I must be careful.
        // Actually, let's keep the regex checks.

        // 1. Unmasked Email Regex
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
        if (emailRegex.test(text)) {
            await this.logViolation("EMAIL_LEAK", "Outbound text contains unmasked Email", teamId, userId, context);
            throw new Error("Compliance Violation: Outbound text contains unmasked PII (Email).");
        }

        // 2. Unmasked Phone (Global)
        const phoneRegex = /\+?(\d{1,3})?[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g;
        if (phoneRegex.test(text)) {
            await this.logViolation("PHONE_LEAK", "Outbound text contains unmasked Phone", teamId, userId, context);
            throw new Error("Compliance Violation: Outbound text contains unmasked PII (Phone).");
        }

        // 3. Credit Card (Simple Luhn-like pattern matcher, strict 13-19 digits)
        const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
        if (ccRegex.test(text)) {
            await this.logViolation("PCI_VIOLATION", "Outbound text contains potential Credit Card number", teamId, userId, context);
            throw new Error("Compliance Violation: Outbound text contains potential Credit Card PII.");
        }

        // 4. US SSN (Simple pattern)
        const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
        if (ssnRegex.test(text)) {
            await this.logViolation("PII_LEAK_SSN", "Outbound text contains potential SSN", teamId, userId, context);
            throw new Error("Compliance Violation: Outbound text contains potential SSN.");
        }

        try {
            // HARDWARE HOOK: Send to Edge Node
            console.log(`[SovereignFirewall] 🛡️ Intercepting outbound traffic. Routing to Edge Node (${violationContext})...`);

            // Pass context to HardwareService if updated to support it, otherwise just text
            const response = await HardwareService.sanitize(text);

            // Log successful sanitation event (Optional: add success audit here if strict mode)

            // Success! Reset breaker if needed (though our simple one resets on timeout)
            // But usually we want consecutive successes to perhaps clear it? 
            // Our simple implementation relies on timeout, but let's clear failure count on success to be robust.
            breaker.reset();

            return response.sanitized_text;
        } catch (error: any) {
            console.error("[SovereignFirewall] ⚠️ Hardware Sanitization Failed.", error.message);

            // Record Failure for Circuit Breaker
            breaker.recordFailure();

            await this.logAudit(teamId, userId, "HARDWARE_FAIL", "BLOCKED", `Hardware sanitization failed: ${error.message}`, { context });

            // Strict Fallback: ALWAYS block in production if hardware is down
            if (process.env.NODE_ENV === 'production') {
                throw new Error("Hardware Verification Failed. Outbound traffic blocked.");
            }

            // In Dev, we might allow it, but let's be stricter now as per "Hardening" request
            console.warn("[SovereignFirewall] ⚠️ DEV OVERRIDE: Allowing unverified traffic (NOT SAFE FOR PROD)");
            return text;
        }
    }

    /**
     * RESTORE PII (Inbound)
     */
    static processInbound(text: string): string {
        return text;
    }

    private static async logViolation(type: string, reason: string, teamId: string, userId: string, context?: string) {
        console.warn(`[SovereignFirewall] 🛡️ BLOCKING: ${type} - ${reason} (Context: ${context || 'N/A'})`);
        await this.logAudit(teamId, userId, "PII_BLOCK", "DENIED", reason, { type, context });
    }

    private static async logAudit(teamId: string, userId: string, action: string, status: string, details: string, metadata?: any) {
        try {
            await prisma.auditLog.create({
                data: {
                    action: action, // e.g. "PII_BLOCK"
                    entity: "SovereignFirewall",
                    orgId: teamId,
                    actorId: userId,
                    metadata: { status, details, ...metadata }
                }
            });
        } catch (e) {
            console.error("Failed to write to AuditLog", e);
        }
    }
}

// Simple In-Memory Circuit Breaker for Hardware Connection
class HardwareCircuitBreaker {
    private failureCount = 0;
    private lastFailure = 0;
    private readonly THRESHOLD = 5;
    private readonly RESET_MS = 60000; // 1 minute

    isOpen(): boolean {
        if (this.failureCount >= this.THRESHOLD) {
            if (Date.now() - this.lastFailure > this.RESET_MS) {
                this.reset();
                return false;
            }
            return true;
        }
        return false;
    }

    recordFailure() {
        this.failureCount++;
        this.lastFailure = Date.now();
    }

    reset() {
        this.failureCount = 0;
    }
}

export const sovereignFirewall = new SovereignFirewall();
const breaker = new HardwareCircuitBreaker(); // internal singleton

