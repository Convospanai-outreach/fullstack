
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";

/**
 * Mock Netjana MCP Server
 * Simulates the external data platform for testing purposes.
 */
const app = express();
const server = new Server(
    {
        name: "Mock-Netjana-Platform",
        version: "1.0.0",
    },
    {
        capabilities: {
            resources: {},
        },
    }
);

// Mock data
const mockIntents: Record<string, any[]> = {
    "default@example.com": [
        { type: "intent", signal: "pricing_page_visit", timestamp: new Date().toISOString(), value: "high" },
        { type: "intent", signal: "comparative_research", timestamp: new Date().toISOString(), value: "medium" }
    ],
    "audit_user@example.com": [
        { type: "intent", signal: "security_whitepaper_download", timestamp: new Date().toISOString(), value: "ultra-high" },
        { type: "intent", signal: "api_docs_exploration", timestamp: new Date().toISOString(), value: "high" }
    ]
};

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "netjana://customers/all/intents",
                name: "Customer Intents Registry",
                mimeType: "application/json",
            }
        ],
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/netjana:\/\/customers\/(.+)\/intents/);
    
    if (match) {
        const customerId = match[1];
        const data = mockIntents[customerId] || mockIntents["default@example.com"];
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(data),
                }
            ],
        };
    }
    
    throw new Error("Resource not found");
});

let transport: SSEServerTransport;

app.get("/mcp", async (req, res) => {
    transport = new SSEServerTransport("/events", res);
    await server.connect(transport);
});

app.post("/events", async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🚀 Mock Netjana MCP Server running at http://localhost:${PORT}/mcp`);
});
