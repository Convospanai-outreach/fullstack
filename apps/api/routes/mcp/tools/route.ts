import { NextRequest, NextResponse } from "next/server";
import { mcpManager } from "@/lib/mcp/McpManager";

export async function GET(req: NextRequest) {
    try {
        await mcpManager.initialize();
        const tools = await mcpManager.getAllTools();
        return NextResponse.json({ ok: true, tools });
    } catch (error: any) {
        console.error("Error fetching MCP tools:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
