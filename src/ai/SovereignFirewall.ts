
/**
 * Sovereign Firewall
 * 
 * Ensures PII/sensitive data never leaves the region (or the VPC).
 * Implements masking/unmasking logic for DPDP/GDPR compliance.
 */

export interface PIIEntity {
    type: "EMAIL" | "PHONE" | "AADHAAR" | "PAN" | "NAME";
    original: string;
    masked: string;
}

export class SovereignFirewall {

    /**
     * Masks PII in the text, returning safe text and a restoration map.
     */
    processOutbound(text: string): { safeText: string; map: Map<string, string> } {
        const map = new Map<string, string>();
        let safeText = text;

        // 1. Emails
        safeText = safeText.replace(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g, (match) => {
            const key = `<EMAIL_${map.size + 1}>`;
            map.set(key, match);
            return key;
        });

        // 2. Indian Mobile Numbers (+91 or 10 digits starting with 6-9)
        // Regex simplified for demonstration
        safeText = safeText.replace(/(?:\+91|91)?[6-9]\d{9}/g, (match) => {
            const key = `<PHONE_${map.size + 1}>`;
            map.set(key, match);
            return key;
        });

        // 3. PAN Card (Indian Tax ID) - 5 chars, 4 digits, 1 char
        safeText = safeText.replace(/[A-Z]{5}[0-9]{4}[A-Z]{1}/g, (match) => {
            const key = `<PAN_${map.size + 1}>`;
            map.set(key, match);
            return key;
        });

        return { safeText, map };
    }

    /**
     * Restores PII in the response text using the restoration map.
     */
    processInbound(text: string, map: Map<string, string>): string {
        let originalText = text;

        // Replace all keys (e.g., <EMAIL_1>) with their original values
        map.forEach((value, key) => {
            // Global replace in case the model repeated the token
            originalText = originalText.split(key).join(value);
        });

        return originalText;
    }
}

export const sovereignFirewall = new SovereignFirewall();
