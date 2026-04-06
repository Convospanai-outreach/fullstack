import { NextResponse } from "next/server";
import { HELP_ARTICLES, searchHelpArticles } from "@/modules/help/content";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const results = query.trim() ? searchHelpArticles(query) : HELP_ARTICLES;

    return NextResponse.json({
        query,
        total: results.length,
        results,
    });
}
