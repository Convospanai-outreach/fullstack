export class TokenManager {
    // Simple estimation: 1 token ~= 4 characters
    private static readonly CHARS_PER_TOKEN = 4;

    static estimateTokens(text: string): number {
        return Math.ceil(text.length / this.CHARS_PER_TOKEN);
    }

    static truncate(text: string, maxTokens: number): string {
        const estimatedTokens = this.estimateTokens(text);
        if (estimatedTokens <= maxTokens) return text;

        const maxChars = maxTokens * this.CHARS_PER_TOKEN;
        return text.slice(0, maxChars) + "... [TRUNCATED]";
    }

    // Simple in-memory rate limiter (for MVP)
    // In production, use Redis
    private static rateLimits: Record<string, { count: number; resetTime: number }> = {};

    static checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
        const now = Date.now();
        const record = this.rateLimits[key];

        if (!record || now > record.resetTime) {
            this.rateLimits[key] = {
                count: 1,
                resetTime: now + windowSeconds * 1000
            };
            return true;
        }

        if (record.count >= limit) {
            return false;
        }

        record.count++;
        return true;
    }
}
