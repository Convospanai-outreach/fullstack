import { HardwareService } from "@/services/HardwareService";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

export class IdentityService {

    /**
     * securely resolves a masked identity to PII using the sovereign edge node.
     * Logs the access purpose for audit trails.
     */
    static async resolveIdentity(maskedId: string, purpose: string, teamId: string): Promise<any> {
        // 1. Audit Log (Pre-access)
        logger.info(`[IdentityVault] Access Request: ${maskedId} by Team ${teamId} for ${purpose}`);

        // 2. Hardware Enclave Call
        try {
            const pii = await HardwareService.reIdentify(maskedId, purpose, teamId);

            // 3. Audit Log (Success)
            logger.info(`[IdentityVault] Access Granted.`);
            return pii;
        } catch (e: any) {
            logger.error(`[IdentityVault] Access Denied or Failed. Error: ${e.message}`);
            throw e;
        }
    }

    /**
     * Verifies the X-Compliance-Hash signature of incoming webhooks.
     * Use this to ensure data is coming from a trusted source (e.g. Edge Node or Partner).
     *
     * `timestamp` (X-Timestamp, epoch ms) is optional for now (roadmap 3.5 / S-16):
     * when the caller sends one, it must be within 5 minutes and is bound into the
     * signature as `${JSON.stringify(payload)}.${timestamp}`, so it can't be edited
     * or stripped. Without one, the legacy body-only signature is still accepted.
     */
    static verifyWebhook(payload: any, signature: string, secret?: string | null, timestamp?: string | null): boolean {
        if (!secret) return false;

        let signedContent = JSON.stringify(payload);
        if (timestamp !== undefined && timestamp !== null) {
            const issuedAt = Number(timestamp);
            if (!timestamp || !Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) {
                return false;
            }
            signedContent = `${signedContent}.${timestamp}`;
        }

        const computed = createHmac('sha256', secret)
            .update(signedContent)
            .digest('hex');

        const computedBuffer = Buffer.from(computed, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');

        if (computedBuffer.length !== signatureBuffer.length) return false;

        return timingSafeEqual(computedBuffer, signatureBuffer);
    }
}
