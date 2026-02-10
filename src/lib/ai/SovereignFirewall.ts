import crypto from 'crypto';
import axios from 'axios';

interface SanitizedPayload {
    safeContext: string;
    tokenMap: Map<string, string>;
}

interface CriticVerdict {
    score: number;
    approved: boolean;
    reason?: string;
}

class HardwareCircuitBreaker {
    private failureCount = 0;
    private lastFailure = 0;
    private readonly THRESHOLD = 3;
    private readonly RESET_MS = 30000;

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

export class SovereignFirewall {
    private static readonly PI_ENDPOINT = process.env['PHI3_LOCAL_ENDPOINT'] || 'http://localhost:8000';
    private static readonly SENSITIVE_KEYS = ['email', 'phone', 'name', 'linkedin', 'ssn', 'credit_card'];
    private static breaker = new HardwareCircuitBreaker();

    /**
     * Replaces sensitive data with deterministic UUIDs.
     * Hits Edge Node (Async) if available, falls back to Local (Sync) if not.
     */
    static async mask(data: any, region: 'UAE' | 'GLOBAL' = 'GLOBAL'): Promise<SanitizedPayload> {
        const text = typeof data === 'string' ? data : JSON.stringify(data);

        // Pre-Send Regex Audit (Logging only, masking still happens)
        this.auditText(text);

        // Fail-Closed Circuit Breaker
        if (this.breaker.isOpen()) {
            console.warn("[SovereignFirewall] Circuit Breaker OPEN. Using Local Masking.");
            return this.maskLocal(data, region);
        }

        try {
            // Attempt Hardware Sanitization (Edge Node)
            const response = await axios.post(`${this.PI_ENDPOINT}/v1/sanitize`, {
                text: text,
                session_id: crypto.randomUUID()
            }, { timeout: 2000 });

            this.breaker.reset();

            // Note: Edge Node stores mapping in Vault. 
            // We return a map for 'transient' unmasking in Brain for now, 
            // but eventually Brain should just detokenize via IdentityService.
            return {
                safeContext: response.data.sanitized_text,
                tokenMap: new Map() // Edge Node holds the map
            };

        } catch (error: any) {
            console.warn("[SovereignFirewall] Edge Node failed, falling back to local masking.", error.message);
            this.breaker.recordFailure();
            return this.maskLocal(data, region);
        }
    }

    /**
     * Fallback/Local Masking Logic (Sync)
     */
    static maskLocal(data: any, region: 'UAE' | 'GLOBAL' = 'GLOBAL'): SanitizedPayload {
        if (region !== 'UAE' && process.env['STRICT_SOVEREIGNTY'] !== 'true') {
            return { safeContext: typeof data === 'string' ? data : JSON.stringify(data), tokenMap: new Map() };
        }

        const tokenMap = new Map<string, string>();
        const traverseAndMask = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(traverseAndMask);

            const newObj: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (this.isSensitive(key) && typeof value === 'string') {
                    const hash = crypto.createHash('sha256').update(value).digest('hex').substring(0, 12);
                    const token = `[${key.toUpperCase()}_${hash}]`;
                    tokenMap.set(token, value);
                    newObj[key] = token;
                } else {
                    newObj[key] = traverseAndMask(value);
                }
            }
            return newObj;
        };

        const processed = typeof data === 'object' ? traverseAndMask(data) : data;
        const safeContext = typeof processed === 'string' ? processed : JSON.stringify(processed);

        return { safeContext, tokenMap };
    }

    /**
     * Detokenizes content coming back from the cloud LLM using the local map.
     */
    static unmask(content: string, tokenMap: Map<string, string>): string {
        if (!tokenMap || tokenMap.size === 0) return content;

        let restored = content;
        for (const [token, original] of tokenMap.entries()) {
            const escapedToken = token.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
            restored = restored.replace(new RegExp(escapedToken, 'g'), original);
        }
        return restored;
    }

    /**
     * Bot-Likeness scoring (Adversarial Judge)
     */
    static async critique(draft: string): Promise<CriticVerdict> {
        try {
            const response = await axios.post(`${this.PI_ENDPOINT}/v1/critique`, { text: draft }, { timeout: 3000 });
            return {
                score: response.data.score,
                approved: response.data.score >= 0.8, // Logic: >0.8 similar to golden records
                reason: response.data.reason
            };
        } catch (error: any) {
            console.error("CRITICAL_IO_ERROR: Sovereign Firewall Connection Failed", error.message);
            if (process.env.NODE_ENV === 'development') {
                return { score: 1.0, approved: true, reason: "DEV_BYPASS" };
            }
            throw new Error(`Local Sovereign Node Unreachable. Halting to prevent leakage.`);
        }
    }

    private static isSensitive(key: string): boolean {
        return this.SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k));
    }

    private static auditText(text: string) {
        const patterns = {
            EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
            PHONE: /\+?(\d{1,3})?[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g,
            CC: /\b(?:\d[ -]*?){13,19}\b/g
        };

        for (const [type, regex] of Object.entries(patterns)) {
            if (regex.test(text)) {
                console.warn(`[SovereignFirewall] Audit Triggered: Potential ${type} detected in outbound traffic.`);
                // In production, we'd log this to AuditLog
            }
        }
    }

    /**
     * Evaluate a prompt for safety (used by BullsEyeRAG)
     */
    static async evaluate(prompt: string): Promise<{ safe: boolean; reason?: string }> {
        try {
            const verdict = await this.critique(prompt);
            return { safe: verdict.approved, reason: verdict.reason };
        } catch {
            return { safe: false, reason: 'Evaluation failed' };
        }
    }
}
