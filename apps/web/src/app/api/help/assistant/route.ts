import { NextResponse } from "next/server";
import { HELP_PROMPTS, HELP_QUICK_ACTIONS, searchHelpArticles } from "@/modules/help/content";

type AssistantRequest = {
    query?: string;
};

function buildAnswer(query: string) {
    const matches = searchHelpArticles(query).slice(0, 3);
    const normalized = query.toLowerCase();

    if (matches.length === 0) {
        return {
            answer:
                "I could not find a direct guide for that yet. Start with the help center, then contact support if the issue blocks signup, setup, billing, or launch.",
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
        answer: `${intentHint} Start with "${first.title}". ${first.summary}`,
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

export async function POST(req: Request) {
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

    return NextResponse.json(buildAnswer(query));
}
