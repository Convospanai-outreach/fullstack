
import { aiService } from "@/lib/aiService";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

/**
 * Backend AI Execution Hub.
 *
 * Routes incoming AI action requests to the actual SDK-dependent services.
 */
export async function POST(req: Request) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const { action, ...params } = body;
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Team context required for AI execution" }, { status: 401 });
        }
        if (params.teamId && params.teamId !== ctx.teamId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        params.teamId = ctx.teamId;

        let result;

        switch (action) {
            case "askAI":
                if (typeof params.prompt !== "string" || !params.prompt.trim()) {
                    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
                }
                const taskContext = {
                    ...(params.taskContext || {}),
                    surface: params.taskContext?.surface || "HELPER",
                    taskType: params.taskContext?.taskType || "HELPER_CHAT"
                };
                const text = await aiService.askAI(params.prompt, params.teamId, taskContext);
                result = { text };
                break;
            
            case "getEmbeddings":
                if (typeof params.text !== "string" || !params.text.trim()) {
                    return NextResponse.json({ error: "Text is required" }, { status: 400 });
                }
                const embeddings = await aiService.getEmbeddings(params.text, params.teamId);
                result = { embeddings };
                break;

            case "generateEmailDraft":
                result = await aiService.generateEmailDraft(params.lead, params.icp, params.teamId);
                break;

            case "analyzeProfile":
                const analysis = await aiService.analyzeProfile(params.profileText, params.teamId);
                result = { text: analysis };
                break;

            case "generateComment":
                const comment = await aiService.generateComment(params.postContent, params.profileContext, params.teamId);
                result = { text: comment };
                break;

            case "generateConnectionMessage":
                const connectionMsg = await aiService.generateConnectionMessage(params.profileContext, params.teamId);
                result = { text: connectionMsg };
                break;

            case "improveEmail":
                const improved = await aiService.improveEmail(params.text, params.teamId);
                result = { text: improved };
                break;

            case "generateSmartReply":
                const replies = await aiService.generateSmartReply(params.context, params.tone, params.memories, params.teamId);
                result = replies;
                break;
            case "researchCompany":
                const research = await aiService.researchCompany(params.companyName, params.teamId);
                result = research;
                break;

            default:
                return Response.json({ error: "Unknown AI action" }, { status: 400 });
        }

        return Response.json(result);
    } catch (error: any) {
        console.error(`[Backend AI] Action Error:`, error.message);
        const message = error?.message || "AI execution failed";
        if (message.includes("Insufficient credits")) {
            return Response.json({ error: message }, { status: 402 });
        }
        if (message.includes("prompt") || message.includes("not allowed") || message.includes("exceeds")) {
            return Response.json({ error: message }, { status: 400 });
        }
        return Response.json({ error: message }, { status: 500 });
    }
}
