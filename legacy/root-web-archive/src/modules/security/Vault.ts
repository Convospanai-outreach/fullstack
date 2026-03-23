
/**
 * Zero-Knowledge Vault (Task 9)
 * 
 * Boundary: Metadata/Configuration stays on server.
 * Secrets/Sessions stay encrypted until reaching the LOCAL executor.
 */

export class ZKVault {
    /**
     * Logic Flow:
     * 1. User enters LinkedIn Password / API Key in Browser.
     * 2. Browser generates RSA Keypair (or uses Hardware Signature).
     * 3. Browser encrypts Secret with Public Key.
     * 4. Server stores EncryptedBlob + KeyID.
     * 5. Local Extension (SafeRun) fetches EncryptedBlob.
     * 6. Local Extension decrypts with Private Key stored in its own extension storage.
     * 
     * RESULT: Plaintext never touches the ConvoSpan servers.
     */

    static async prepareForStorage(plaintext: string, publicKey: string): Promise<string> {
        const { publicEncrypt, constants } = await import("crypto");
        const buffer = Buffer.from(plaintext, "utf8");
        const encrypted = publicEncrypt(
            {
                key: publicKey,
                padding: constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            buffer
        );
        return `zk_sealed_v1_${encrypted.toString("base64")}`;
    }

    static async decryptForExecution(blob: string, privateKey: string): Promise<string> {
        if (!blob.startsWith("zk_sealed_v1_")) {
            throw new Error("Security Violation: Attempted to process unsealed credential or legacy format.");
        }
        const { privateDecrypt, constants } = await import("crypto");
        const encryptedData = blob.replace("zk_sealed_v1_", "");
        const buffer = Buffer.from(encryptedData, "base64");
        const decrypted = privateDecrypt(
            {
                key: privateKey,
                padding: constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            buffer
        );
        return decrypted.toString("utf8");
    }

    /**
     * Trust Boundary Enforcement (Task 9)
     */
    static enforceBoundary(data: any) {
        const sensitiveKeys = ['password', 'token', 'apiKey', 'sessionCookie'];
        for (const key of sensitiveKeys) {
            if (data[key] && !data[key].startsWith("zk_sealed_")) {
                throw new Error(`Data Leak Prevention: Key '${key}' must be encrypted client-side.`);
            }
        }
    }
}
