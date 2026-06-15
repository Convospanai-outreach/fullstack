import { NextRequest, NextResponse } from "next/server";
import { HELP_PROMPTS, HELP_QUICK_ACTIONS, searchHelpArticles } from "@/modules/help/content";

type AssistantRequest = {
    query?: string;
};

type AnswerSource = "faq" | "knowledge" | "cache" | "llm" | "not_found" | "local";

type ApiAnswer = {
    answer: string;
    source: AnswerSource;
    confidence: number;
    usedLLM: boolean;
    citations?: Array<{ id: string; title?: string; snippet: string }>;
};

function buildAnswer(query: string, apiAnswer?: ApiAnswer) {
    const matches = searchHelpArticles(query).slice(0, 3);
    const normalized = query.toLowerCase();

    if (matches.length === 0) {
        return {
            answer: apiAnswer?.answer ||
                "I could not find a direct guide for that yet. Start with the help center, then contact support if the issue blocks signup, setup, billing, or launch.",
            source: apiAnswer?.source || "local",
            confidence: apiAnswer?.confidence || 55,
            usedLLM: apiAnswer?.usedLLM || false,
            citations: apiAnswer?.citations || [],
            suggestions: HELP_PROMPTS,
            matches: [],
            actions: HELP_QUICK_ACTIONS,
        };
    }

    const first = matches[0]!;
    const intentHint = normalized.includes("billing") || normalized.includes("plan") || normalized.includes("checkout")
        ? "This looks billing-related."
        : normalized.includes("setup") || normalized.includes("onboard")
            ? "This looks like a setup blocker."
            : normalized.includes("import") || normalized.includes("lead")
                ? "This looks like a data import question."
                : "I found the closest guide for this question.";

    return {
        answer: apiAnswer?.answer || `${intentHint} Start with "${first.title}". ${first.summary}`,
        source: apiAnswer?.source || "local",
        confidence: apiAnswer?.confidence || 70,
        usedLLM: apiAnswer?.usedLLM || false,
        citations: apiAnswer?.citations || [],
        suggestions: HELP_PROMPTS.filter((prompt) => prompt.toLowerCase() !== normalized).slice(0, 3),
        matches: matches.map((article) => ({
            slug: article.slug,
            title: article.title,
            category: article.category,
            summary: article.summary,
            href: `/help#${article.slug}`,
            actions: article.actions || [],
        })),
        actions: [
            ...(first.actions || []),
            ...HELP_QUICK_ACTIONS.filter((action) => !first.actions?.some((existing) => existing.href === action.href)),
        ].slice(0, 4),
    };
}

async function getApiAnswer(req: NextRequest, query: string): Promise<ApiAnswer | undefined> {
    try {
        const response = await fetch(new URL("/api/proxy/assistant/answer", req.nextUrl.origin), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                cookie: req.headers.get("cookie") || "",
            },
            body: JSON.stringify({ question: query, context: "support" }),
        });

        if (!response.ok) {
            return undefined;
        }

        const data = await response.json();
        if (typeof data?.answer !== "string" || typeof data?.source !== "string") {
            return undefined;
        }

        return data as ApiAnswer;
    } catch {
        return undefined;
    }
}

export async function POST(req: NextRequest) {
    let body: AssistantRequest;

    try {
        body = (await req.json()) as AssistantRequest;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const query = body.query?.trim();
    if (!query) {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const apiAnswer = await getApiAnswer(req, query);
    return NextResponse.json(buildAnswer(query, apiAnswer));
}
