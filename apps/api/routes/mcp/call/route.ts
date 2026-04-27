import { NextRequest, NextResponse } from "next/server";
import { mcpManager } from "@/lib/mcp/McpManager";
// Assuming there might be some basic auth logic available, but we'll try/catch and let the manager handle args.

export async function POST(req: NextRequest) {
    try {
        // Here we could extract session user and teamId. For MVP we pass them down if provided.
        // We'll read x-team-id or pull from body.
        
        const body = await req.json();
        const { name, args } = body;
        
        if (!name) {
            return NextResponse.json({ ok: false, error: "Tool name is required" }, { status: 400 });
        }

        const teamId = body.teamId || req.headers.get("x-team-id");
        
        const context = {
            teamId: teamId || undefined,
            source: "web-proxy",
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
