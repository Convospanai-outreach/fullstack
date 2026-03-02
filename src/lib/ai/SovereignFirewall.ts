import crypto from 'crypto';
import axios from 'axios';
import { IdentityService } from '@/modules/identity/IdentityService';

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
    static async mask(data: string | Record<string, unknown> | unknown[], region: 'UAE' | 'GLOBAL' = 'GLOBAL'): Promise<SanitizedPayload> {
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

            return {
                safeContext: response.data.sanitized_text,
                tokenMap: new Map() // Edge Node holds the map
            };

        } catch (error: any) {
            this.breaker.recordFailure();

            // FAIL-CLOSED Logic for Strict Sovereignty
            if (process.env['STRICT_SOVEREIGNTY'] === 'true') {
                console.error("[SovereignFirewall] CRITICAL: Edge Node unreachable. STRICT_SOVEREIGNTY is TRUE. Failing closed.");
                throw new Error("Sovereign Node Unreachable. PII Exposure Risk Blocked.");
            }

            console.warn("[SovereignFirewall] Edge Node failed, falling back to local masking.", error.message);
            return this.maskLocal(data, region);
        }
    }

    /**
     * Fallback/Local Masking Logic (Sync)
     */
    static maskLocal(data: string | Record<string, unknown> | unknown[], region: 'UAE' | 'GLOBAL' = 'GLOBAL'): SanitizedPayload {
        const tokenMap = new Map<string, string>();

        if (region !== 'UAE' && process.env['STRICT_SOVEREIGNTY'] !== 'true') {
            return { safeContext: typeof data === 'string' ? data : JSON.stringify(data), tokenMap };
        }

        const traverseAndMask = (obj: unknown): any => {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(traverseAndMask);

            const newObj: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
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
        let safeContext = typeof processed === 'string' ? processed : JSON.stringify(processed);

        // EXTRA LAYER: Regex-based masking for unstructured text in the final prompt
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
        safeContext = safeContext.replace(emailRegex, (match) => {
            const hash = crypto.createHash('sha256').update(match).digest('hex').substring(0, 12);
            const token = `[EMAIL_${hash}]`;
            tokenMap.set(token, match);
            return token;
        });

        // Add phone masking if needed
        const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
        safeContext = safeContext.replace(phoneRegex, (match) => {
            const hash = crypto.createHash('sha256').update(match).digest('hex').substring(0, 12);
            const token = `[PHONE_${hash}]`;
            tokenMap.set(token, match);
            return token;
        });

        return { safeContext, tokenMap };
    }

    /**
     * Detokenizes content coming back from the cloud LLM using the local map.
     */
    static unmask(content: string, tokenMap: Map<string, string>): string {
        if (!tokenMap || tokenMap.size === 0) return content;

        let restored = content;
        for (const [token, original] of tokenMap.entries()) {
            const escapedToken = token.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
                .replace(/\</g, '\\<').replace(/\>/g, '\\>');
            restored = restored.replace(new RegExp(escapedToken, 'g'), original);
        }
        return restored;
    }

    /**
     * detokenizes content asynchronously by resolving unknown tokens via IdentityService (Vault).
     */
    static async unmaskAsync(content: string, tokenMap: Map<string, string>, teamId: string, purpose: string): Promise<string> {
        // 1. First unmask using the local transient map (Fast)
        let restored = this.unmask(content, tokenMap);

        // 2. Identify remaining tokens that look like Edge Node tags: <ENTITY_N ...> or [ENTITY_HASH]
        const edgeTokenRegex = /<([A-Z]+)_\d+[^>]*>|\[([A-Z]+)_[a-f0-9]{12}\]/g;
        const matches = Array.from(restored.matchAll(edgeTokenRegex));

        if (matches.length === 0) return restored;

        // 3. Resolve all unique tokens in parallel
        const uniqueTokens = Array.from(new Set(matches.map(m => m[0])));

        await Promise.all(uniqueTokens.map(async (fullToken) => {
            try {
                const pii = await IdentityService.resolveIdentity(fullToken, purpose, teamId);
                const replacement = typeof pii === 'object' ? (pii.email || pii.name || JSON.stringify(pii)) : String(pii);
                restored = restored.split(fullToken).join(replacement);
            } catch (e) {
                console.warn(`[SovereignFirewall] Failed to resolve token ${fullToken}:`, e);
            }
        }));

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
    static async evaluate(prompt: string): Promise<{ safe: boolean; reason?: string | undefined }> {
        try {
            const verdict = await this.critique(prompt);
            return { safe: verdict.approved, reason: verdict.reason };
        } catch {
            return { safe: false, reason: 'Evaluation failed' };
        }
    }
}
