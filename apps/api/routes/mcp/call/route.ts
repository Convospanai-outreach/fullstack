import { NextRequest, NextResponse } from "next/server";
import { mcpManager } from "@/lib/mcp/McpManager";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        // teamId must come from the caller's real session, never the request body or a
        // client-settable header - tools like read_app_learning_memories are gated on
        // context.teamId matching the tenant whose data is being read, and that gate is
        // worthless if the caller can simply assert whichever teamId they want.
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, args } = body;

        if (!name) {
            return NextResponse.json({ ok: false, error: "Tool name is required" }, { status: 400 });
        }

        const context = {
            teamId,
            source: "service" as const,
            approved: false // Needs explicit handling if it's a high-risk tool
        };

        await mcpManager.initialize();
        const result = await mcpManager.callTool(name, args || {}, context);
        
        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error("Error calling MCP tool:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
