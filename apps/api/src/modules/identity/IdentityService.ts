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
            const pii = await HardwareService.reIdentify(maskedId, purpose);

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
     */
    static verifyWebhook(payload: any, signature: string, secret?: string | null): boolean {
        if (!secret) return false;

        const computed = createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        const computedBuffer = Buffer.from(computed, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');

        if (computedBuffer.length !== signatureBuffer.length) return false;

        return timingSafeEqual(computedBuffer, signatureBuffer);
    }
}
