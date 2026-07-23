
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

/**
 * NetjanaMCPClient Proxy
 * Migrated to backend.
 */
export class NetjanaMCPClient {
    constructor() {}

    async connect(): Promise<void> {
        // Connection handle on backend
    }

    async getCustomerIntents(customerId: string): Promise<any[]> {
        try {
            const res = await fetch(`${API_URL}/mcp/intents?customerId=${customerId}`);
            if (!res.ok) throw new Error("MCP proxy failure");
            const data = await res.json();
            return data.intents || [];
        } catch (error) {
            console.error(`Error fetching intents for customer ${customerId}:`, error);
            return [];
        }
    }

    async close(): Promise<void> {
        // Close handle on backend
    }
}
