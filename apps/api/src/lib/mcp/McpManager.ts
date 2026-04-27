
import { McpClient } from "./McpClient";
import { McpExecutionContext, McpRiskLevel, McpServerConfig, McpTool } from "./types";

type McpClientLike = {
    listTools: () => Promise<McpTool[]>;
    callTool: (name: string, args: any) => Promise<any>;
    connect?: () => Promise<void>;
};

interface RegisteredTool {
    clientId: string;
    tool: McpTool;
    riskLevel: McpRiskLevel;
}

class McpManager {
    private clients: Map<string, McpClientLike> = new Map();
    private toolRegistry: Map<string, RegisteredTool> = new Map();
    private initialized: boolean = false;
    private initializePromise?: Promise<void>;

    async initialize() {
        if (this.initialized) {
            return;
        }

        if (this.initializePromise) {
            await this.initializePromise;
            return;
        }

        this.initializePromise = this.initializeInternal();

        try {
            await this.initializePromise;
            this.initialized = true;
        } finally {
            this.initializePromise = undefined;
        }
    }

    private async initializeInternal() {
        console.log("[McpManager] Initializing...");

        await this.registerInternalComputerUse();
        await this.registerInternalNetjana();
        await this.registerInternalAppLearnings();
        await this.registerInternalLinkedIn();
        await this.refreshToolRegistry();
    }

    private async registerInternalLinkedIn() {
        try {
            const { linkedinServer } = await import("@/modules/integration/mcp/linkedin-server");

            const client: McpClientLike = {
                listTools: async () => this.normalizeTools(linkedinServer.getTools()),
                callTool: async (name: string, args: any) => linkedinServer.callTool(name, args),
                connect: async () => {}
            };

            this.clients.set("linkedin", client);
            console.log("[McpManager] LinkedIn Server registered.");
        } catch (error) {
            console.error("[McpManager] LinkedIn Server unavailable:", error);
        }
    }

    private async registerInternalComputerUse() {
        try {
            const { ComputerUseServer } = await import("./servers/ComputerUseServer");
            const server = new ComputerUseServer();
            const client = await server.initialize();
            this.clients.set("computer-use", client);
            console.log("[McpManager] Computer Use Server registered.");
        } catch (error) {
            console.error("[McpManager] Computer Use Server unavailable:", error);
        }
    }

    private async registerInternalNetjana() {
        try {
            const { NetjanaMCPServer } = await import("@/modules/integration/mcp/netjana-server");
            const netjana = new NetjanaMCPServer();

            const client: McpClientLike = {
                listTools: async () => this.normalizeTools(netjana.getTools()),
                callTool: async (name: string, args: any) => netjana.callTool(name, args),
                connect: async () => {}
            };

            this.clients.set("netjana", client);
            console.log("[McpManager] Netjana Server registered.");
        } catch (error) {
            console.error("[McpManager] Netjana Server unavailable:", error);
        }
    }

    private async registerInternalAppLearnings() {
        try {
            const { AppLearningsMCPServer } = await import("@/modules/integration/mcp/app-learnings-server");
            const appLearnings = new AppLearningsMCPServer();

            const client: McpClientLike = {
                listTools: async () => this.normalizeTools(appLearnings.getTools()),
                callTool: async (name: string, args: any) => appLearnings.callTool(name, args),
                connect: async () => {}
            };

            this.clients.set("app-learnings", client);
            console.log("[McpManager] App Learnings Server registered.");
        } catch (error) {
            console.error("[McpManager] App Learnings Server unavailable:", error);
        }
    }

    async registerServer(config: McpServerConfig): Promise<McpClientLike> {
        const existingClient = this.clients.get(config.id);
        if (existingClient) {
            return existingClient;
        }

        const client = new McpClient(config);
        await client.connect();
        this.clients.set(config.id, client);
        await this.indexClientTools(config.id, client);
        return client;
    }

    getClient(serverId: string): McpClientLike | undefined {
        return this.clients.get(serverId);
    }

    async getAllTools(): Promise<McpTool[]> {
        await this.initialize();
        return Array.from(this.toolRegistry.values()).map(entry => ({
            ...entry.tool,
            riskLevel: entry.riskLevel
        }));
    }

    getToolDefinition(name: string): McpTool | undefined {
        const entry = this.toolRegistry.get(name);
        if (!entry) {
            return undefined;
        }
        return {
            ...entry.tool,
            riskLevel: entry.riskLevel
        };
    }

    getToolRiskLevel(name: string): McpRiskLevel | undefined {
        return this.toolRegistry.get(name)?.riskLevel;
    }

    validateToolArgs(name: string, args: Record<string, any>): void {
        const tool = this.getToolDefinition(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found in MCP registry.`);
        }

        const schema = tool.inputSchema || {};
        if ((schema as any).type !== "object") {
            return;
        }

        if (!args || typeof args !== "object" || Array.isArray(args)) {
            throw new Error(`Tool ${name} requires object arguments.`);
        }

        const properties = ((schema as any).properties || {}) as Record<string, any>;
        const required = Array.isArray((schema as any).required) ? (schema as any).required : [];

        for (const field of required) {
            if (!(field in args)) {
                throw new Error(`Tool ${name} is missing required argument '${field}'.`);
            }
        }

        if ((schema as any).additionalProperties === false) {
            for (const key of Object.keys(args)) {
                if (!(key in properties)) {
                    throw new Error(`Tool ${name} received unsupported argument '${key}'.`);
                }
            }
        }

        for (const [key, config] of Object.entries(properties)) {
            if (!(key in args) || !config || typeof config !== "object") {
                continue;
            }

            const expectedType = (config as any).type;
            if (!expectedType) {
                continue;
            }

            const value = args[key];
            if (!this.isValueCompatibleWithType(value, expectedType)) {
                throw new Error(`Tool ${name} argument '${key}' must be of type '${expectedType}'.`);
            }
        }
    }

    async callTool(name: string, args: any, context: McpExecutionContext = {}): Promise<any> {
        await this.initialize();

        const registration = this.toolRegistry.get(name);
        if (!registration) {
            throw new Error(`Tool ${name} not found in MCP registry.`);
        }

        const normalizedArgs = this.enforceTeamScopedArgs(name, args, context);
        this.validateToolArgs(name, normalizedArgs as Record<string, any>);

        if (registration.riskLevel === "high" && !context.approved) {
            const bypassEnabled = process.env["ALLOW_UNSAFE_MCP_BYPASS"] === "true" && context.bypassGovernance === true;
            if (!bypassEnabled) {
                throw new Error(`High-risk MCP tool '${name}' requires explicit approval.`);
            }
            console.warn(`[McpManager] Unsafe governance bypass enabled for tool '${name}'.`);
        }

        const client = this.clients.get(registration.clientId);
        if (!client) {
            throw new Error(`Tool ${name} is registered to unavailable server '${registration.clientId}'.`);
        }

        return client.callTool(name, normalizedArgs);
    }

    private enforceTeamScopedArgs(name: string, args: any, context: McpExecutionContext): Record<string, any> {
        const input = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {};
        const teamScopedTools = new Set([
            "read_app_learning_summary",
            "read_app_learning_memories",
            "search_app_learning_events",
            "share_app_learning_memory",
            "read_app_learning_toon"
        ]);

        if (!teamScopedTools.has(name)) {
            return input;
        }

        const contextTeamId = typeof context.teamId === "string" ? context.teamId.trim() : "";
        const argTeamId = typeof input["team_id"] === "string" ? String(input["team_id"]).trim() : "";

        if (!contextTeamId) {
            throw new Error(`Tool ${name} requires context.teamId for tenant-safe execution.`);
        }

        if (argTeamId && argTeamId !== contextTeamId) {
            throw new Error(`Tool ${name} team_id must match context.teamId.`);
        }

        input["team_id"] = contextTeamId;
        return input;
    }

    private isValueCompatibleWithType(value: unknown, expectedType: string): boolean {
        switch (expectedType) {
            case "string":
                return typeof value === "string";
            case "number":
                return typeof value === "number" && Number.isFinite(value);
            case "integer":
                return typeof value === "number" && Number.isInteger(value);
            case "boolean":
                return typeof value === "boolean";
            case "object":
                return !!value && typeof value === "object" && !Array.isArray(value);
            case "array":
                return Array.isArray(value);
            default:
                return true;
        }
    }

    private inferRiskLevel(toolName: string): McpRiskLevel {
        if (toolName.startsWith("read_") || toolName.startsWith("search_") || toolName === "fetch_customer_intent") {
            return "low";
        }
        return "high";
    }

    private normalizeTools(rawTools: any[]): McpTool[] {
        const normalized: McpTool[] = [];

        for (const rawTool of rawTools || []) {
            const name = typeof rawTool?.name === "string" ? rawTool.name : "";
            if (!name) {
                continue;
            }

            const inputSchema = rawTool?.inputSchema ?? rawTool?.input_schema ?? {};
            normalized.push({
                name,
                description: typeof rawTool?.description === "string" ? rawTool.description : "",
                inputSchema: inputSchema && typeof inputSchema === "object" ? inputSchema : {}
            });
        }

        return normalized;
    }

    private async refreshToolRegistry(): Promise<void> {
        this.toolRegistry.clear();

        for (const [clientId, client] of this.clients.entries()) {
            await this.indexClientTools(clientId, client);
        }
    }

    private async indexClientTools(clientId: string, client: McpClientLike): Promise<void> {
        let tools: McpTool[] = [];

        try {
            tools = this.normalizeTools(await client.listTools());
        } catch (error) {
            console.error(`[McpManager] Failed to list tools for server '${clientId}':`, error);
            return;
        }

        for (const tool of tools) {
            const existing = this.toolRegistry.get(tool.name);
            if (existing && existing.clientId !== clientId) {
                console.error(
                    `[McpManager] Duplicate tool name '${tool.name}' from '${clientId}' ignored; already owned by '${existing.clientId}'.`
                );
                continue;
            }

            const riskLevel = this.inferRiskLevel(tool.name);
            this.toolRegistry.set(tool.name, {
                clientId,
                tool: {
                    ...tool,
                    riskLevel
                },
                riskLevel
            });
        }
    }
}

export const mcpManager = new McpManager();
