import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ListResourcesResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCPClient
 * Service to ingest data from the Netjana platform using the Model Context Protocol.
 */
export class NetjanaMCPClient {
    private client: Client;
    private transport: SSEClientTransport;

    constructor() {
        const netjanaUrl = process.env['NETJANA_MCP_URL'] || "http://localhost:4000/mcp";
        this.transport = new SSEClientTransport(new URL(netjanaUrl));
        this.client = new Client(
            {
                name: "ConvoSpan-Knowledge-Engine",
                version: "1.0.0",
            },
            {
                capabilities: {
                    resources: {},
                },
            }
        );
    }

    async connect() {
        try {
            await this.client.connect(this.transport);
            console.log("Connected to Netjana MCP Server");
        } catch (error) {
            console.error("Failed to connect to Netjana MCP:", error);
            throw error;
        }
    }

    /**
     * Fetches real-time intents for a specific customer.
     */
    async getCustomerIntents(customerId: string): Promise<any[]> {
        try {
            const resourceUri = `netjana://customers/${customerId}/intents`;
            const result = await this.client.request(
                {
                    method: "resources/read",
                    params: {
                        uri: resourceUri,
                    },
                },
                ReadResourceResultSchema
            );

            if (!result.contents || result.contents.length === 0) {
                return [];
            }

            // Assuming the content is JSON stringified in the resource
            const content = (result.contents[0] as any).text;
            return content ? JSON.parse(content) : [];
        } catch (error) {
            console.error(`Error fetching intents for customer ${customerId}:`, error);
            return [];
        }
    }

    async close() {
        await this.client.close();
    }
}
