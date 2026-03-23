
import { z } from "zod";

export interface Tool<T = any> {
    name: string;
    description: string;
    schema: z.ZodType<T>;
    execute: (params: T, context: any) => Promise<any>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool) {
        if (this.tools.has(tool.name)) {
            console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
        }
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    list() {
        return Array.from(this.tools.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.schema, // In a real system, you'd convert Zod to JSON Schema here
        }));
    }

    /**
     * Helper to convert Zod schema to OpenAI function format (simplified)
     */
    getOpenAIFunctions() {
        return Array.from(this.tools.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: {
                type: "object",
                properties: {}, // Note: Requires robust zod-to-json-schema conversion in production
            },
        }));
    }
}

export const toolRegistry = new ToolRegistry();
