"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LifeBuoy, Search, ShieldCheck, Sparkles } from "lucide-react";
import { ContactSupportForm } from "@/components/support/ContactSupportForm";
import { HELP_ARTICLES, HELP_PROMPTS, type HelpArticle } from "@/modules/help/content";

type HelpResponse = {
    results: HelpArticle[];
};

function filterArticles(query: string) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
        return HELP_ARTICLES;
    }

    return HELP_ARTICLES.filter((article) => {
        const haystack = [
            article.title,
            article.category,
            article.summary,
            article.content,
        ].join(" ").toLowerCase();

        return haystack.includes(trimmed);
    });
}

function renderArticleContent(content: string) {
    return content.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
            return null;
        }

        if (trimmed.startsWith("# ")) {
            return <h1 key={index} className="text-3xl font-semibold text-[#0c1b30]">{trimmed.slice(2)}</h1>;
        }

        if (trimmed.startsWith("## ")) {
            return <h2 key={index} className="pt-3 text-xl font-semibold text-[#0c1b30]">{trimmed.slice(3)}</h2>;
        }

        if (/^\d+\.\s/.test(trimmed)) {
            return <p key={index} className="pl-1 text-sm leading-7 text-[#0c1b30]/85">{trimmed}</p>;
        }

        if (trimmed.startsWith("- ")) {
            return <p key={index} className="pl-1 text-sm leading-7 text-[#0c1b30]/85">{`\u2022 ${trimmed.slice(2)}`}</p>;
        }

        return <p key={index} className="text-sm leading-7 text-[#0c1b30]/75">{trimmed}</p>;
    });
}

export default function HelpPage() {
    const [query, setQuery] = useState("");
    const [articles, setArticles] = useState<HelpArticle[]>(HELP_ARTICLES);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const trimmed = query.trim();

        if (process.env['NODE_ENV'] !== "production") {
            setArticles(filterArticles(trimmed));
            return () => controller.abort();
        }

        setIsLoading(true);
        const endpoint = trimmed ? `/api/help/search?q=${encodeURIComponent(trimmed)}` : "/api/help/search";

        fetch(endpoint, { signal: controller.signal })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to load help articles");
                }
                return (await res.json()) as HelpResponse;
            })
            .then((data) => setArticles(data.results))
            .catch((error) => {
                if (error instanceof Error && error.name === "AbortError") {
                    return;
                }
                setArticles(filterArticles(trimmed));
            })
            .finally(() => setIsLoading(false));

        return () => controller.abort();
    }, [query]);

    useEffect(() => {
        if (articles.length === 0) {
            setSelectedSlug(null);
            return;
        }

        setSelectedSlug((current) => {
            const hashSlug = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
            if (hashSlug && articles.some((article) => article.slug === hashSlug)) {
                return hashSlug;
            }
            if (current && articles.some((article) => article.slug === current)) {
                return current;
            }
            return articles[0]?.slug ?? null;
        });
    }, [articles]);

    const activeArticle = useMemo(
        () => articles.find((article) => article.slug === selectedSlug) ?? null,
        [articles, selectedSlug]
    );

    return (
        <div className="min-h-screen font-[family-name:var(--font-home)] bg-[#f5f5f5] text-[#0c1b30]">
            <section className="relative overflow-hidden border-b border-[#0c1b30]/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.18),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.98),rgba(7,17,31,0.94))]" />
                <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#ffc247] bg-[#ffc247]/20 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#0c1b30]">
                            <LifeBuoy className="h-3.5 w-3.5" />
                            Help Center
                        </div>
                        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-[#0c1b30] sm:text-5xl lg:text-6xl">
                            Yes, you can get unstuck here.
                        </h1>
                        <p className="mt-5 max-w-2xl text-base leading-7 text-[#0c1b30]/75 sm:text-lg">
                            Search the core guides, find the next step, or contact support when you need a human reply.
                        </p>
                    </div>

                    <div className="grid gap-3 text-sm text-[#0c1b30]/85 sm:grid-cols-3 lg:w-[32rem]">
                        {[
                            "Fast answers for setup, billing, and imports",
                            "Clear next steps when something blocks you",
                            "Support available when the guide is not enough",
                        ].map((item) => (
                            <div key={item} className="rounded-3xl border border-[#0c1b30]/10 bg-white px-4 py-4 backdrop-blur-xl">
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr,0.9fr]">
                <section className="space-y-6">
                    <div className="rounded-[28px] border border-[#0c1b30]/10 bg-white p-5 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                        <label htmlFor="help-search" className="text-xs uppercase tracking-[0.2em] text-[#0c1b30]/65">
                            What do you need help with?
                        </label>
                        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#0c1b30]/10 bg-[#081221] px-4 py-3">
                            <Search className="h-4 w-4 text-[#0c1b30]/55" />
                            <input
                                id="help-search"
                                type="text"
                                placeholder="Search setup, billing, imports, API keys..."
                                className="min-w-0 flex-1 bg-transparent text-base text-[#0c1b30] outline-none placeholder:text-[#0c1b30]/55"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {HELP_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => setQuery(prompt)}
                                    className="rounded-full border border-[#0c1b30]/10 px-3 py-1.5 text-sm text-[#0c1b30]/85 transition hover:border-amber-300/40 hover:bg-white"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[0.95fr,1.05fr]">
                        <aside className="rounded-[28px] border border-[#0c1b30]/10 bg-white p-4">
                            <div className="flex items-center justify-between gap-3 px-2 pb-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#0c1b30]/55">Topics</p>
                                    <p className="mt-1 text-sm text-[#0c1b30]/75">
                                        {query.trim() ? "Closest matches for your search" : "Start with the most common blockers"}
                                    </p>
                                </div>
                                <span className="rounded-full border border-[#0c1b30]/10 px-3 py-1 text-xs text-[#0c1b30]/75">
                                    {articles.length} results
                                </span>
                            </div>

                            <div className="space-y-2">
                                {articles.map((article) => (
                                    <button
                                        key={article.slug}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSlug(article.slug);
                                            if (typeof window !== "undefined") {
                                                window.history.replaceState(null, "", `#${article.slug}`);
                                            }
                                        }}
                                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                            activeArticle?.slug === article.slug
                                                ? "border-amber-300/40 bg-[#ffc247]/20"
                                                : "border-white/8 bg-transparent hover:border-[#0c1b30]/15 hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <h2 className="font-medium text-[#0c1b30]">{article.title}</h2>
                                            <span className="text-xs uppercase tracking-[0.18em] text-[#006a9a]">{article.category}</span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-[#0c1b30]/75">{article.summary}</p>
                                    </button>
                                ))}

                                {!isLoading && articles.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-[#0c1b30]/10 px-4 py-8 text-center text-sm text-[#0c1b30]/65">
                                        No direct match yet. Ask the assistant or contact support.
                                    </div>
                                )}
                            </div>
                        </aside>

                        <div className="rounded-[28px] border border-[#0c1b30]/10 bg-[#081221] p-6">
                            {activeArticle ? (
                                <article id={activeArticle.slug} className="space-y-3">
                                    {renderArticleContent(activeArticle.content)}
                                </article>
                            ) : (
                                <div className="flex min-h-[20rem] items-center justify-center text-sm text-[#0c1b30]/65">
                                    Select a guide to view details.
                                </div>
                            )}

                            {activeArticle?.actions && activeArticle.actions.length > 0 && (
                                <div className="mt-8 flex flex-wrap gap-3 border-t border-[#0c1b30]/10 pt-6">
                                    {activeArticle.actions.map((action) => (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            className="inline-flex items-center gap-2 rounded-full border border-[#0c1b30]/10 px-4 py-2 text-sm text-[#0c1b30] transition hover:border-amber-300/40 hover:bg-white"
                                        >
                                            {action.label}
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <aside className="space-y-6">
                    <div className="rounded-[28px] border border-[#0c1b30]/10 bg-[#e8e6e3] p-6">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#006a9a]">
                            <Sparkles className="h-4 w-4" />
                            When You Need Help
                        </div>
                        <h2 className="mt-4 text-2xl font-semibold text-[#0c1b30]">Use the floating help assistant, then contact support if needed.</h2>
                        <p className="mt-3 text-sm leading-6 text-[#0c1b30]/75">
                            It suggests the closest guide and includes a clear support path when you need more help.
                        </p>
                        <div className="mt-6 space-y-3 text-sm text-[#0c1b30]/85">
                            <div className="rounded-2xl border border-[#0c1b30]/10 bg-white px-4 py-3">Ask about setup blockers, billing, imports, and API keys</div>
                            <div className="rounded-2xl border border-[#0c1b30]/10 bg-white px-4 py-3">Jump to the right page from the assistant</div>
                            <div className="rounded-2xl border border-[#0c1b30]/10 bg-white px-4 py-3">Contact support when a guide is not enough</div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-[#0c1b30]/10 bg-white p-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-[#006a9a]" />
                            <div>
                                <h3 className="font-semibold text-[#0c1b30]">Support that stays simple</h3>
                                <p className="text-sm text-[#0c1b30]/75">Use the assistant first, then contact support when you need a human reply.</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link href="/contact" className="rounded-full border border-[#0c1b30]/10 px-4 py-2 text-sm text-[#0c1b30] transition hover:border-amber-300/40 hover:bg-white">
                                Contact support
                            </Link>
                            <a href="mailto:contact.us@craftmyfunnel.live" className="rounded-full border border-[#0c1b30]/10 px-4 py-2 text-sm text-[#0c1b30] transition hover:border-amber-300/40 hover:bg-white">
                                Email support
                            </a>
                        </div>
                    </div>

                    <ContactSupportForm />
                </aside>
            </div>
        </div>
    );
}
