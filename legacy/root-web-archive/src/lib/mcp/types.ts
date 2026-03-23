
export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}

export interface McpToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface McpToolResult {
    content: Array<{
        type: string;
        text?: string;
        blob?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

export interface McpServerConfig {
    id: string;
    name: string;
    transport: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    headers?: Record<string, string>; // For SSE authentication
}
