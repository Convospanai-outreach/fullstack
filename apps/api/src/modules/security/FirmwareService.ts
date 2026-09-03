import crypto from 'crypto';

/**
 * Firmware Service
 * Handles Digital Signing and Remote Attestation for Edge Nodes (Jetson).
 * Ensures that only code signed by the "CraftMyFunnel Developer Key" is running.
 */
export class FirmwareService {
    // In production, these should be loaded from a secure HSM or KMS
    private static PRIVATE_KEY = process.env['FIRMWARE_PRIVATE_KEY'];
    private static PUBLIC_KEY = process.env['FIRMWARE_PUBLIC_KEY'];
    private static EXPECTED_HASH = process.env['FIRMWARE_EXPECTED_HASH'];

    /**
     * Signs a firmware payload or configuration blob.
     */
    static signPayload(data: object): string {
        if (!this.PRIVATE_KEY) {
            throw new Error("Firmware signing key is not configured");
        }
        const payload = JSON.stringify(data);
        const sign = crypto.createSign('SHA256');
        sign.update(payload);
        sign.end();
        return sign.sign(this.PRIVATE_KEY, 'hex');
    }

    /**
     * Verifies an Attestation Report from an Edge Node.
     * The node sends a hash of its running software stack (TPM PCR values).
     */
    static verifyAttestation(nodeId: string, measuredBootHash: string): boolean {
        if (!this.EXPECTED_HASH) {
            throw new Error("Firmware expected hash is not configured");
        }

        console.log(`[FirmwareService] Verifying Node ${nodeId}. Received: ${measuredBootHash}`);

        const expected = Buffer.from(this.EXPECTED_HASH);
        const actual = Buffer.from(measuredBootHash);
        if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
            return true;
        }

        // For "Spy" protection: Refuse connection if hash mismatches
        console.warn(`[SecureBoot] ALERT: Node ${nodeId} failed attestation! Potential tampering.`);
        return false;
    }
}
