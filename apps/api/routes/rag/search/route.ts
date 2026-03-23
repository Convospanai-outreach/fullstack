import { NextRequest, NextResponse } from "next/server";
import { RAGService } from "@/lib/ragService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentContext } from "@/lib/auth";

/**
 * GET /api/rag/search
 * Test RAG retrieval and get statistics
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query");
        const teamId = ctx.teamId;

        if (!query || !teamId) {
            return NextResponse.json(
                { error: "Missing required parameters: query, teamId" },
                { status: 400 }
            );
        }

        // Retrieve context
        const context = await RAGService.retrieveContext(query, teamId, {
            maxTokens: 2000,
            minRelevance: 0.7
        });

        // Get stats
        const stats = await RAGService.getRetrievalStats(query, teamId);

        return NextResponse.json({
            query,
            teamId,
            context,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[RAG API] Error:", error);
        return NextResponse.json(
            { error: "RAG retrieval failed", details: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/rag/search
 * Retrieve context with custom options
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { query, maxTokens, minRelevance, limit } = body;
        const teamId = ctx.teamId;

        if (!query || !teamId) {
            return NextResponse.json(
                { error: "Missing required fields: query, teamId" },
                { status: 400 }
            );
        }

        const context = await RAGService.retrieveContext(query, teamId, {
            maxTokens: maxTokens || 2000,
            minRelevance: minRelevance || 0.7,
            limit: limit || 10
        });

        const stats = await RAGService.getRetrievalStats(query, teamId);

        return NextResponse.json({
            success: true,
            context,
            stats
        });
    } catch (error: any) {
        console.error("[RAG API] Error:", error);
        return NextResponse.json(
            { error: "RAG retrieval failed", details: error.message },
            { status: 500 }
        );
    }
}
