
import { z } from "zod";
import { Tool, toolRegistry } from "./ToolRegistry";
import { SearchService } from "@/modules/search/service/SearchService";
import { prisma } from "@/lib/db";
import { crmService } from "@/modules/crm-integration/service/crmService";

// --- Search Tool ---
const SearchSchema = z.object({
    query: z.string().describe("The search query to execute"),
    limit: z.number().optional().default(5).describe("Number of results to return"),
});

const SearchTool: Tool<z.infer<typeof SearchSchema>> = {
    name: "Search",
    description: "Search the internal database for leads, campaigns, and knowledge.",
    schema: SearchSchema,
    execute: async ({ query, limit }, context) => {
        if (!context?.teamId) return { error: "No team context" };

        const results = await SearchService.globalSearch(context.teamId, query);

        // Flatten results to snippets
        const snippets: any[] = [];

        results.leads.forEach(l => snippets.push({ title: `Lead: ${l.fullName}`, snippet: `${l.jobTitle} at ${l.company}` }));
        results.campaigns.forEach(c => snippets.push({ title: `Campaign: ${c.name}`, snippet: c.description }));
        results.knowledge.forEach(k => snippets.push({ title: `Knowledge: ${k.name}`, snippet: k.description }));

        return snippets.slice(0, limit);
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
    execute: async ({ leadId, notes }, context) => {
        console.log(`[Tool:CRM] Updating lead ${leadId} with notes: ${notes}`);

        if (!context?.teamId) return { error: "No team context" };

        // leadId is an LLM-chosen tool-call argument, not otherwise guaranteed to belong
        // to this team - verify before attaching a note or syncing to this team's CRM.
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId: context.teamId } });
        if (!lead) return { error: "Lead not found" };

        // 1. Add Note as Internal Message
        await prisma.message.create({
            data: {
                leadId,
                content: notes,
                direction: "INBOUND",
                platform: "INTERNAL_NOTE",
                status: "received"
            }
        });

        // 2. Sync to HubSpot
        const syncResult = await crmService.syncLead(leadId, context.teamId);

        return { success: true, leadId, syncStatus: syncResult.status };
    },
};

// --- Feedback Loop Tool ---
const FeedbackLoopSchema = z.object({
    teamId: z.string().describe("The Team ID context"),
    originalText: z.string().describe("The original AI generated text"),
    editedText: z.string().describe("The user's corrected version"),
    context: z.any().optional().describe("Additional context like tone, audience, etc.")
});

const FeedbackLoopTool: Tool<z.infer<typeof FeedbackLoopSchema>> = {
    name: "Feedback_Loop_Capture",
    description: "Record a user's correction to AI content to improve future generations (RLHF).",
    schema: FeedbackLoopSchema,
    execute: async ({ teamId, originalText, editedText, context }) => {
        // Dynamically import to avoid circular dependencies if any
        const { feedbackLoop } = await import("@/modules/learning/FeedbackLoopService");

        await feedbackLoop.captureEdit(teamId, originalText, editedText, context);

        return { success: true, message: "Feedback captured for model improvement." };
    }
};

// Register them
export function registerStandardTools() {
    toolRegistry.register(SearchTool);
    toolRegistry.register(CRMTool);
    toolRegistry.register(FeedbackLoopTool);
}
