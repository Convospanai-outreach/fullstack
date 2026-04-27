import { McpServerConfig, McpTool } from "./types";

class McpManager {
    async initialize() {
        console.log("[McpManager-WebProxy] Initialized");
    }

    async registerServer(config: McpServerConfig) {
        console.warn("[McpManager-WebProxy] Skipping server registration in web layer. MCP execution is backend-only.");
        return null;
    }

    getClient(serverId: string) {
        return null;
    }

    async getAllTools(): Promise<McpTool[]> {
        // Query the API for tools
        try {
            const origin = typeof window !== "undefined" ? window.location.origin : process.env['API_BASE_URL'] || "http://localhost:3000";
            const res = await fetch(`${origin}/api/proxy/mcp/tools`);
            if (res.ok) {
                const data = await res.json();
                return data.tools || [];
            }
        } catch (e) {
            console.error("Failed to fetch tools from API", e);
        }
        return [];
    }

    async callTool(name: string, args: any): Promise<any> {
        const origin = typeof window !== "undefined" ? window.location.origin : process.env['API_BASE_URL'] || "http://localhost:3000";
        const res = await fetch(`${origin}/api/proxy/mcp/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, args })
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Tool call failed");
        }
        return data.result;
    }
}

export const mcpManager = new McpManager();
