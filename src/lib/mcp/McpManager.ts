
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

            // Register Netjana Server
            const { NetjanaMCPServer } = await import("@/modules/integration/mcp/netjana-server");
            const netjana = new NetjanaMCPServer();
            // We can wrap it in a client or just register its tools
            // For internal consistency, we keep internal servers in a separate set or wrap them
            this.clients.set("netjana", {
                listTools: async () => netjana.getTools(),
                callTool: async (name, args) => netjana.callTool(name, args),
                connect: async () => {},
                config: { id: "netjana", name: "Netjana", transport: "sse" } // Virtual config
            } as any);
            console.log("[McpManager] Netjana Server registered.");
        } catch (e) {
            console.error("[McpManager] Failed to register Internal Servers:", e);
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

    async callTool(name: string, args: any): Promise<any> {
        for (const client of this.clients.values()) {
            try {
                const tools = await client.listTools();
                if (tools.find(t => t.name === name)) {
                    return await client.callTool(name, args);
                }
            } catch (e) {
                console.error(`Failed to check tools for client:`, e);
            }
        }
        throw new Error(`Tool ${name} not found in any registered MCP server.`);
    }
}

export const mcpManager = new McpManager();
