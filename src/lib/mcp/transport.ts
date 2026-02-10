/**
 * MCP Transport Layer
 * 
 * Implements Stdio and SSE (Server-Sent Events) transports for MCP servers
 * following the MCP specification.
 */

import { spawn, ChildProcess } from "child_process";
import { EventSource } from "eventsource";

export interface TransportConfig {
    type: "stdio" | "sse";
    // Stdio config
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    // SSE config
    url?: string;
    headers?: Record<string, string>;
}

export interface McpMessage {
    jsonrpc: "2.0";
    id?: number | string;
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export abstract class Transport {
    protected onMessage?: ((message: McpMessage) => void) | undefined;
    protected onError?: ((error: Error) => void) | undefined;
    protected onClose?: (() => void) | undefined;

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract send(message: McpMessage): Promise<void>;
    abstract isConnected(): boolean;

    setHandlers(handlers: {
        onMessage?: ((message: McpMessage) => void) | undefined;
        onError?: ((error: Error) => void) | undefined;
        onClose?: (() => void) | undefined;
    }) {
        this.onMessage = handlers.onMessage;
        this.onError = handlers.onError;
        this.onClose = handlers.onClose;
    }
}

/**
 * Stdio Transport - spawns a child process and communicates via stdin/stdout
 */
export class StdioTransport extends Transport {
    private process?: ChildProcess | undefined;
    private buffer: string = "";
    private config: TransportConfig;

    constructor(config: TransportConfig) {
        super();
        if (!config.command) {
            throw new Error("Stdio transport requires 'command' in config");
        }
        this.config = config;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[StdioTransport] Spawning: ${this.config.command} ${this.config.args?.join(" ") || ""}`);

                this.process = spawn(this.config.command!, this.config.args || [], {
                    env: { ...process.env, ...this.config.env },
                    stdio: ["pipe", "pipe", "pipe"]
                });

                // Handle stdout (messages from server)
                this.process.stdout?.on("data", (data: Buffer) => {
                    this.buffer += data.toString();
                    this.processBuffer();
                });

                // Handle stderr (logs from server)
                this.process.stderr?.on("data", (data: Buffer) => {
                    console.error(`[StdioTransport:stderr] ${data.toString()}`);
                });

                // Handle process errors
                this.process.on("error", (error) => {
                    console.error("[StdioTransport] Process error:", error);
                    this.onError?.(error);
                    reject(error);
                });

                // Handle process exit
                this.process.on("exit", (code, signal) => {
                    console.log(`[StdioTransport] Process exited with code ${code}, signal ${signal}`);
                    this.onClose?.();
                });

                // Wait a moment for process to start
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        console.log("[StdioTransport] Connected successfully");
                        resolve();
                    } else {
                        reject(new Error("Process failed to start"));
                    }
                }, 500);

            } catch (error) {
                reject(error);
            }
        });
    }

    private processBuffer() {
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const message = JSON.parse(line) as McpMessage;
                this.onMessage?.(message);
            } catch (error) {
                console.error("[StdioTransport] Failed to parse message:", line);
            }
        }
    }

    async send(message: McpMessage): Promise<void> {
        if (!this.process || this.process.killed) {
            throw new Error("Process not connected");
        }

        const json = JSON.stringify(message) + "\n";

        return new Promise((resolve, reject) => {
            this.process!.stdin?.write(json, (error) => {
                if (error) {
                    console.error("[StdioTransport] Failed to send message:", error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        if (this.process && !this.process.killed) {
            this.process.kill();
            this.process = undefined;
        }
    }

    isConnected(): boolean {
        return !!this.process && !this.process.killed;
    }
}

/**
 * SSE Transport - connects to an HTTP server using Server-Sent Events
 */
export class SseTransport extends Transport {
    private eventSource?: EventSource | undefined;
    private config: TransportConfig;
    private connected: boolean = false;

    constructor(config: TransportConfig) {
        super();
        if (!config.url) {
            throw new Error("SSE transport requires 'url' in config");
        }
        this.config = config;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[SseTransport] Connecting to: ${this.config.url}`);

                this.eventSource = new EventSource(this.config.url!, {
                    headers: this.config.headers
                } as any);

                this.eventSource.onopen = () => {
                    console.log("[SseTransport] Connection opened");
                    this.connected = true;
                    resolve();
                };

                this.eventSource.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data) as McpMessage;
                        this.onMessage?.(message);
                    } catch (error) {
                        console.error("[SseTransport] Failed to parse message:", event.data);
                    }
                };

                this.eventSource.onerror = (error) => {
                    console.error("[SseTransport] Connection error:", error);
                    this.connected = false;
                    this.onError?.(new Error("SSE connection error"));
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    async send(message: McpMessage): Promise<void> {
        if (!this.connected) {
            throw new Error("Not connected to SSE server");
        }

        // For SSE, we typically need a separate POST endpoint to send messages
        // This is a limitation of SSE (unidirectional)
        const endpoint = this.config.url!.replace("/events", "/send");

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.config.headers
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            this.connected = false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

/**
 * Factory to create the appropriate transport
 */
export function createTransport(config: TransportConfig): Transport {
    switch (config.type) {
        case "stdio":
            return new StdioTransport(config);
        case "sse":
            return new SseTransport(config);
        default:
            throw new Error(`Unsupported transport type: ${config.type}`);
    }
}
