
import { z } from "zod";
import { Tool, toolRegistry } from "./ToolRegistry";

// --- Search Tool ---
const SearchSchema = z.object({
    query: z.string().describe("The search query to execute"),
    limit: z.number().optional().default(5).describe("Number of results to return"),
});

const SearchTool: Tool<z.infer<typeof SearchSchema>> = {
    name: "Search",
    description: "Search the web or internal database for information.",
    schema: SearchSchema,
    execute: async ({ query, limit }) => {
        // Mock implementation
        console.log(`[Tool:Search] Searching for: ${query}`);
        return [
            { title: "Result 1", snippet: "Information about " + query },
            { title: "Result 2", snippet: "More details on " + query },
        ].slice(0, limit);
    },
};

// --- CRM Update Tool ---
const CRMUpdateSchema = z.object({
    leadId: z.string().describe("ID of the lead to update"),
    notes: z.string().describe("Notes to add to the lead"),
    sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
});

const CRMTool: Tool<z.infer<typeof CRMUpdateSchema>> = {
    name: "CRM_Update",
    description: "Update the CRM with new notes or status.",
    schema: CRMUpdateSchema,
    execute: async ({ leadId, notes }) => {
        console.log(`[Tool:CRM] Updating lead ${leadId} with notes: ${notes}`);
        // Real impl: await prisma.lead.update(...) AND sync to HubSpot
        return { success: true, leadId };
    },
};

// Register them
export function registerStandardTools() {
    toolRegistry.register(SearchTool);
    toolRegistry.register(CRMTool);
}
