/**
 * Mock Model Context Protocol (MCP) Server for Slack
 * Simulates Anthropic's MCP structure for local development/testing.
 */

export interface HelperTool {
    name: string;
    description: string;
    input_schema: any;
    handler: (args: any) => Promise<any>;
}

export class SlackMCPServer {
    private tools: HelperTool[] = [];

    constructor() {
        this.registerTools();
    }

    private registerTools() {
        this.tools.push({
            name: "post_message",
            description: "Post a message to a Slack channel",
            input_schema: {
                type: "object",
                properties: {
                    channel_id: { type: "string" },
                    text: { type: "string" }
                },
                required: ["channel_id", "text"]
            },
            handler: async ({ channel_id, text }) => {
                console.log(`[MCP:Slack] Posting to ${channel_id}: "${text}"`);
                return { success: true, ts: Date.now().toString() };
            }
        });

        this.tools.push({
            name: "read_channel",
            description: "Read recent messages from a channel",
            input_schema: {
                type: "object",
                properties: {
                    channel_id: { type: "string" },
                    limit: { type: "number" }
                },
                required: ["channel_id"]
            },
            handler: async ({ channel_id, limit = 10 }) => {
                console.log(`[MCP:Slack] Reading ${limit} msgs from ${channel_id}`);
                return {
                    messages: [
                        { user: "U123", text: "Latest update on the deal?", ts: "1700000001" },
                        { user: "U456", text: "Meeting confirmed for Tuesday.", ts: "1700000002" }
                    ]
                };
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

export const slackServer = new SlackMCPServer();
