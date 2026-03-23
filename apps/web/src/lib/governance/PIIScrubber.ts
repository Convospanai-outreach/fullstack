
export class PIIScrubber {
    private static PATTERNS = {
        // Regex patterns for PII detection
        EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        PHONE: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
        CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
        SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
        // IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
    };

    /**
     * Redacts PII from the input text using defined patterns.
     * Replaces detected entities with [REDACTED-<TYPE>].
     */
    static scrub(text: string): string {
        let scrubbed = text;

        scrubbed = scrubbed.replace(this.PATTERNS.EMAIL, '[REDACTED-EMAIL]');
        scrubbed = scrubbed.replace(this.PATTERNS.PHONE, '[REDACTED-PHONE]');
        scrubbed = scrubbed.replace(this.PATTERNS.CREDIT_CARD, '[REDACTED-CREDIT-CARD]');
        scrubbed = scrubbed.replace(this.PATTERNS.SSN, '[REDACTED-SSN]');

        return scrubbed;
    }

    /**
     * Checks if text contains any potentially sensitive PII.
     */
    static containsPII(text: string): boolean {
        return (
            this.PATTERNS.EMAIL.test(text) ||
            this.PATTERNS.PHONE.test(text) ||
            this.PATTERNS.CREDIT_CARD.test(text) ||
            this.PATTERNS.SSN.test(text)
        );
    }
}
