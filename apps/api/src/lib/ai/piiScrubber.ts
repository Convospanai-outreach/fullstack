export function scrubPII(text: string): string {
  // Simple regex-based redaction for common PII patterns.
  // Email addresses
  let redacted = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  // Phone numbers (various formats)
  redacted = redacted.replace(/\b(\+?\d{1,3}[\s-]?)?(\(\d{2,4}\)[\s-]?|\d{2,4}[\s-])?\d{3,4}[\s-]?\d{3,4}\b/g, '[REDACTED_PHONE]');
  // Credit card numbers (13-19 digits, grouped)
  redacted = redacted.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD]');
  // SSN (US)
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  return redacted;
}
