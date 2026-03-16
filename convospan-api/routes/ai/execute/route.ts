
import { aiService } from "../../services/ai/aiService";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentContext } from "@/lib/auth";

/**
 * Backend AI Execution Hub.
 * 
 * Routes incoming AI action requests to the actual SDK-dependent services.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const { action, ...params } = body;
        const ctx = await getCurrentContext();
        if (ctx.teamId) {
            if (params.teamId && params.teamId !== ctx.teamId) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            params.teamId = ctx.teamId;
        }

        let result;

        switch (action) {
            case "askAI":
                const text = await aiService.askAI(params.prompt, params.teamId, params.taskContext);
                result = { text };
                break;
            
            case "getEmbeddings":
                const embeddings = await aiService.getEmbeddings(params.text);
                result = { embeddings };
                break;

            case "generateEmailDraft":
                result = await aiService.generateEmailDraft(params.lead, params.icp, params.teamId);
                break;

            case "analyzeProfile":
                const analysis = await aiService.analyzeProfile(params.profileText);
                result = { text: analysis };
                break;

            case "generateComment":
                const comment = await aiService.generateComment(params.postContent, params.profileContext);
                result = { text: comment };
                break;

            case "generateConnectionMessage":
                const connectionMsg = await aiService.generateConnectionMessage(params.profileContext);
                result = { text: connectionMsg };
                break;

            case "improveEmail":
                const improved = await aiService.improveEmail(params.text);
                result = { text: improved };
                break;

            case "generateSmartReply":
                const replies = await aiService.generateSmartReply(params.context, params.tone, params.memories);
                result = replies;
                break;

            default:
                return Response.json({ error: "Unknown AI action" }, { status: 400 });
        }

        return Response.json(result);
    } catch (error: any) {
        console.error(`[Backend AI] Action Error:`, error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
