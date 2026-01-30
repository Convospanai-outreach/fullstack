import { Region } from "@prisma/client";
import axios from "axios";

export class IdentityService {
    // In a real deployment, these would point to different physical IP addresses
    private static EDGE_UAE = process.env.EDGE_NODE_UAE || "http://edge-node-uae:8000";
    private static EDGE_GLOBAL = process.env.EDGE_NODE_GLOBAL || "http://edge-node-sim:8000";

    /**
     * Resolves a PII token to its original value by querying the Sovereign Vault.
     * This acts as the "Identity Broker" ensuring Zero-Brain Access.
     */
    static async reidentify(token: string, region: Region, sessionId?: string): Promise<string | null> {
        const endpoint = region === Region.UAE ? this.EDGE_UAE : this.EDGE_GLOBAL;

        try {
            const response = await axios.post(`${endpoint}/v1/reidentify`, {
                token,
                session_id: sessionId
            }, { timeout: 3000 });

            if (response.data && response.data.original) {
                return response.data.original;
            }
            return null;
        } catch (error) {
            console.error(`[IdentityVault] Re-identification failed for token ${token} in ${region}:`, error);
            // Fail Closed: If vault is unreachable, PII remains masked.
            return null;
        }
    }
}
