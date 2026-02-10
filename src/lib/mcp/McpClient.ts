
import { McpServerConfig, McpTool, McpToolResult } from "./types";
import { Transport, createTransport, McpMessage } from "./transport";

/**
 * A generic client to interact with an MCP Server.
 * Supports Stdio and SSE transports.
 */
export class McpClient {
    private config: McpServerConfig;
    private transport?: Transport;
    private isConnected: boolean = false;
    private tools: Map<string, McpTool> = new Map();
    private requestId: number = 0;
    private pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map();

    constructor(config: McpServerConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        console.log(`[McpClient:${this.config.id}] Connecting via ${this.config.transport}...`);

        // Create appropriate transport
        try {
            this.transport = createTransport({
                type: this.config.transport,
                command: this.config.command,
                args: this.config.args,
                env: this.config.env,
                url: this.config.url,
                headers: this.config.headers
            });

            // Set up message handlers
            this.transport.setHandlers({
                onMessage: (message) => this.handleMessage(message),
                onError: (error) => this.handleError(error),
                onClose: () => this.handleClose()
            });

            // Connect transport
            await this.transport.connect();
            this.isConnected = true;

            // Perform MCP handshake (initialize)
            await this.initialize();

            // Discover available tools
            await this.discoverTools();

            console.log(`[McpClient:${this.config.id}] Connected successfully with ${this.tools.size} tools`);
        } catch (error: any) {
            console.error(`[McpClient:${this.config.id}] Connection failed:`, error);
            throw new Error(`Failed to connect to MCP server: ${error.message}`);
        }
    }

    private async initialize(): Promise<void> {
        const response = await this.sendRequest("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            clientInfo: {
                name: "ConvoSpan",
                version: "1.0.0"
            }
        });

        console.log(`[McpClient:${this.config.id}] Initialized:`, response);
    }

    private async discoverTools(): Promise<void> {
        const response = await this.sendRequest("tools/list", {});

        if (response.tools && Array.isArray(response.tools)) {
            this.tools.clear();
            for (const tool of response.tools) {
                this.tools.set(tool.name, tool);
            }
        }
    }

    private async sendRequest(method: string, params: any): Promise<any> {
        if (!this.transport || !this.isConnected) {
            throw new Error("Client not connected");
        }

        const id = ++this.requestId;
        const message: McpMessage = {
            jsonrpc: "2.0",
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            this.transport!.send(message).catch(error => {
                this.pendingRequests.delete(id);
                reject(error);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request timeout: ${method}`));
                }
            }, 30000);
        });
    }

    private handleMessage(message: McpMessage) {
        // Handle response to request
        if (message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id as number);
            if (pending) {
                this.pendingRequests.delete(message.id as number);

                if (message.error) {
                    pending.reject(new Error(message.error.message));
                } else {
                    pending.resolve(message.result);
                }
            }
        }
        // Handle notifications (no id)
        else if (message.method) {
            console.log(`[McpClient:${this.config.id}] Notification:`, message.method, message.params);
        }
    }

    private handleError(error: Error) {
        console.error(`[McpClient:${this.config.id}] Transport error:`, error);
        this.isConnected = false;
    }

    private handleClose() {
        console.log(`[McpClient:${this.config.id}] Connection closed`);
        this.isConnected = false;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error("Connection closed"));
        }
        this.pendingRequests.clear();
    }

    async disconnect(): Promise<void> {
        if (this.transport) {
            await this.transport.disconnect();
        }
        this.isConnected = false;
        console.log(`[McpClient:${this.config.id}] Disconnected.`);
    }

    async listTools(): Promise<McpTool[]> {
        if (!this.isConnected) throw new Error("Client not connected");
        return Array.from(this.tools.values());
    }

    async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
        if (!this.isConnected) throw new Error("Client not connected");

        console.log(`[McpClient:${this.config.id}] Calling tool '${name}' with args:`, args);

        const response = await this.sendRequest("tools/call", {
            name,
            arguments: args
        });

        return response as McpToolResult;
    }

    /**
     * For internal/mock servers to register tools directly
     * (used by ComputerUseServer which is an embedded server)
     */
    registerTool(tool: McpTool) {
        this.tools.set(tool.name, tool);
    }
}
