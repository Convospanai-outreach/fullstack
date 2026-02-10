
import { McpClient } from "./McpClient";
import { McpServerConfig, McpTool } from "./types";

class McpManager {
    private clients: Map<string, McpClient> = new Map();

    async initialize() {
        console.log("[McpManager] Initializing...");
        // Auto-register Internal Servers
        try {
            const { ComputerUseServer } = await import("./servers/ComputerUseServer");
            const server = new ComputerUseServer();
            const client = await server.initialize();
            this.clients.set("computer-use", client);
            console.log("[McpManager] Computer Use Server registered.");
        } catch (e) {
            console.error("[McpManager] Failed to register Computer Use Server:", e);
        }
    }

    async registerServer(config: McpServerConfig): Promise<McpClient> {
        if (this.clients.has(config.id)) {
            return this.clients.get(config.id)!;
        }

        const client = new McpClient(config);
        await client.connect();
        this.clients.set(config.id, client);
        return client;
    }

    getClient(serverId: string): McpClient | undefined {
        return this.clients.get(serverId);
    }

    async getAllTools(): Promise<McpTool[]> {
        const allTools: McpTool[] = [];
        for (const client of this.clients.values()) {
            try {
                const tools = await client.listTools();
                allTools.push(...tools);
            } catch (e) {
                console.error(`Failed to list tools for client`, e);
            }
        }
        return allTools;
    }
}

export const mcpManager = new McpManager();
