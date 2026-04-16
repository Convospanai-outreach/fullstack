/**
 * Slack MCP Server
 * Connects to Slack Web API.
 */

export interface HelperTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
}

const SLACK_API_URL = process.env["SLACK_API_URL"] || "https://slack.com/api";
const MAX_SLACK_MESSAGE_LENGTH = Number(process.env["SLACK_MAX_MESSAGE_LENGTH"] || 4000);

function parseCsvEnv(key: string): Set<string> {
    const value = process.env[key];
    if (!value) {
        return new Set();
    }
    return new Set(value.split(",").map(item => item.trim()).filter(Boolean));
}

const SLACK_ALLOWED_CHANNELS = parseCsvEnv("SLACK_ALLOWED_CHANNELS");

function getSlackToken() {
    const token = process.env["SLACK_BOT_TOKEN"];
    if (!token) {
        throw new Error("SLACK_BOT_TOKEN is not configured");
    }
    return token;
}

function assertAllowedChannel(channelId: string) {
    if (SLACK_ALLOWED_CHANNELS.size === 0) {
        return;
    }
    if (!SLACK_ALLOWED_CHANNELS.has(channelId)) {
        throw new Error(`Channel '${channelId}' is not in SLACK_ALLOWED_CHANNELS.`);
    }
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
            inputSchema: {
                type: "object",
                properties: {
                    channel_id: { type: "string" },
                    text: { type: "string" }
                },
                required: ["channel_id", "text"]
            },
            handler: async ({ channel_id, text }) => {
                assertAllowedChannel(channel_id);

                if (typeof text !== "string" || text.length === 0) {
                    throw new Error("Slack message text is required.");
                }
                if (text.length > MAX_SLACK_MESSAGE_LENGTH) {
                    throw new Error(`Slack message exceeds max length of ${MAX_SLACK_MESSAGE_LENGTH}.`);
                }

                const token = getSlackToken();
                const response = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ channel: channel_id, text })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || `Slack API error ${response.status}`);
                }

                return { success: true, ts: data.ts, channel: data.channel };
            }
        });

        this.tools.push({
            name: "read_channel",
            description: "Read recent messages from a channel",
            inputSchema: {
                type: "object",
                properties: {
                    channel_id: { type: "string" },
                    limit: { type: "number" }
                },
                required: ["channel_id"]
            },
            handler: async ({ channel_id, limit = 10 }) => {
                assertAllowedChannel(channel_id);

                const token = getSlackToken();
                const url = new URL(`${SLACK_API_URL}/conversations.history`);
                url.searchParams.set("channel", channel_id);
                url.searchParams.set("limit", String(limit));

                const response = await fetch(url.toString(), {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || `Slack API error ${response.status}`);
                }

                return { messages: data.messages || [] };
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

export const slackServer = new SlackMCPServer();
