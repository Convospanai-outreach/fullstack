/**
 * Netjana MCP Server
 * Handles ingestion of customer intent data from the Netjana Signal Scraper.
 * Exposes tools for the Agentic Engine to fetch real-time market signals.
 */

import axios from "axios";

export interface HelperTool {
    name: string;
    description: string;
    input_schema: any;
    handler: (args: any) => Promise<any>;
}

export class NetjanaMCPServer {
    private tools: HelperTool[] = [];
    private readonly NETJANA_URL = process.env["NETJANA_URL"] || "http://netjana-api.internal";

    constructor() {
        this.registerTools();
    }

    private registerTools() {
        this.tools.push({
            name: "fetch_customer_intent",
            description: "Fetch real-time customer intent signals from Netjana for a specific domain or keyword",
            input_schema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Companies, keywords or domains to search for" },
                    lookback_days: { type: "number", default: 7 }
                },
                required: ["query"]
            },
            handler: async ({ query, lookback_days = 7 }) => {
                console.log(`[MCP:Netjana] Ingesting intent for: ${query}`);

                try {
                    const response = await axios.get(`${this.NETJANA_URL}/signals`, {
                        params: { q: query, days: lookback_days }
                    });

                    return {
                        source: "Netjana",
                        signals: response.data.signals || [],
                        timestamp: new Date().toISOString()
                    };
                } catch (e: any) {
                    const message = e?.message || "Netjana request failed";
                    throw new Error(message);
                }
            }
        });
    }

    getTools() {
        return this.tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema
        }));
    }

    async callTool(name: string, args: any) {
        const tool = this.tools.find(t => t.name === name);
        if (!tool) throw new Error(`Tool not found: ${name}`);
        return tool.handler(args);
    }
}

export const netjanaServer = new NetjanaMCPServer();
