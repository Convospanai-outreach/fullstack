/**
 * Gmail MCP Server
 * Connects to Gmail REST API using an OAuth access token.
 */

import { HelperTool } from "./slack-server";

const GMAIL_API_URL = process.env["GMAIL_API_URL"] || "https://gmail.googleapis.com/gmail/v1";
const GMAIL_SENDER_ADDRESS = process.env["GMAIL_SENDER_ADDRESS"] || "";

function getGmailToken() {
    const token = process.env["GMAIL_OAUTH_ACCESS_TOKEN"];
    if (!token) {
        throw new Error("GMAIL_OAUTH_ACCESS_TOKEN is not configured");
    }
    return token;
}

function encodeMessage(message: string) {
    return Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export class GmailMCPServer {
    private tools: HelperTool[] = [];

    constructor() {
        this.registerTools();
    }

    private registerTools() {
        this.tools.push({
            name: "send_email",
            description: "Send an email via Gmail API",
            input_schema: {
                type: "object",
                properties: {
                    to: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" }
                },
                required: ["to", "subject", "body"]
            },
            handler: async ({ to, subject, body }) => {
                const token = getGmailToken();
                const headers = [
                    "Content-Type: text/plain; charset=\"UTF-8\"",
                    "MIME-Version: 1.0",
                    "Content-Transfer-Encoding: 7bit",
                    `To: ${to}`,
                    `Subject: ${subject}`
                ];

                if (GMAIL_SENDER_ADDRESS) {
                    headers.unshift(`From: ${GMAIL_SENDER_ADDRESS}`);
                }

                const message = `${headers.join("\n")}\n\n${body}`;
                const raw = encodeMessage(message);

                const response = await fetch(`${GMAIL_API_URL}/users/me/messages/send`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ raw })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const errorMessage = data?.error?.message || `Gmail API error ${response.status}`;
                    throw new Error(errorMessage);
                }

                return { success: true, id: data.id, threadId: data.threadId };
            }
        });

        this.tools.push({
            name: "search_threads",
            description: "Search email threads",
            input_schema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    limit: { type: "number" }
                },
                required: ["query"]
            },
            handler: async ({ query, limit = 5 }) => {
                const token = getGmailToken();
                const url = new URL(`${GMAIL_API_URL}/users/me/threads`);
                url.searchParams.set("q", query);
                url.searchParams.set("maxResults", String(limit));

                const response = await fetch(url.toString(), {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const errorMessage = data?.error?.message || `Gmail API error ${response.status}`;
                    throw new Error(errorMessage);
                }

                return { threads: data.threads || [] };
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

export const gmailServer = new GmailMCPServer();
