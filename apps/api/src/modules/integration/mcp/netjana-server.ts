/**
 * Netjana MCP Server
 * Handles ingestion of customer intent data from the Netjana Signal Scraper.
 * Exposes tools for the Agentic Engine to fetch real-time market signals.
 */

import axios from "axios";

export interface HelperTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
}

export class NetjanaMCPServer {
    private tools: HelperTool[] = [];
    private readonly NETJANA_URL = process.env["NETJANA_URL"] || "http://netjana-api.internal";
    private readonly MAX_QUERY_LENGTH = Number(process.env["NETJANA_MAX_QUERY_LENGTH"] || 200);
    private readonly MAX_LOOKBACK_DAYS = Number(process.env["NETJANA_MAX_LOOKBACK_DAYS"] || 30);

    constructor() {
        this.registerTools();
    }

    private registerTools() {
        this.tools.push({
            name: "fetch_customer_intent",
            description: "Fetch real-time customer intent signals from Netjana for a specific domain or keyword",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Companies, keywords or domains to search for" },
                    lookback_days: { type: "number", default: 7 }
                },
                required: ["query"]
            },
            handler: async ({ query, lookback_days = 7 }) => {
                if (typeof query !== "string" || query.trim().length === 0) {
                    throw new Error("query is required");
                }
                if (query.length > this.MAX_QUERY_LENGTH) {
                    throw new Error(`query exceeds max length of ${this.MAX_QUERY_LENGTH}`);
                }

                const lookback = Number(lookback_days);
                if (!Number.isFinite(lookback) || lookback < 1 || lookback > this.MAX_LOOKBACK_DAYS) {
                    throw new Error(`lookback_days must be between 1 and ${this.MAX_LOOKBACK_DAYS}`);
                }

                console.log(`[MCP:Netjana] Ingesting intent for: ${query}`);

                try {
                    const response = await axios.get(`${this.NETJANA_URL}/signals`, {
                        params: { q: query, days: lookback }
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
            inputSchema: t.inputSchema
        }));
    }

    async callTool(name: string, args: any) {
        const tool = this.tools.find(t => t.name === name);
        if (!tool) throw new Error(`Tool not found: ${name}`);
        return tool.handler(args);
    }
}

export const netjanaServer = new NetjanaMCPServer();
