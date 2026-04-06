"use client";

import Link from "next/link";
import { useState } from "react";
import { LifeBuoy, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { HELP_PROMPTS } from "@/modules/help/content";

type AssistantMatch = {
    slug: string;
    title: string;
    category: string;
    summary: string;
    href: string;
};

type AssistantAction = {
    label: string;
    href: string;
    kind: "page" | "mailto";
};

type AssistantResponse = {
    answer: string;
    suggestions: string[];
    matches: AssistantMatch[];
    actions: AssistantAction[];
};

type Message = {
    role: "user" | "assistant";
    text: string;
};

const DEFAULT_ANSWER =
    "Ask about setup, billing, imports, or API keys. I will point you to the fastest path and give you a human handoff when needed.";

export function SupportAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", text: DEFAULT_ANSWER },
    ]);
    const [response, setResponse] = useState<AssistantResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const submitQuery = async (nextQuery: string) => {
        const trimmed = nextQuery.trim();
        if (!trimmed) {
            return;
        }

        setIsOpen(true);
        setIsLoading(true);
        setQuery("");
        setMessages((current) => [...current, { role: "user", text: trimmed }]);

        try {
            const res = await fetch("/api/help/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: trimmed }),
            });
            const data = (await res.json()) as AssistantResponse | { error?: string };

            if (!res.ok || "error" in data) {
                throw new Error("Unable to reach the help assistant right now.");
            }

            const assistantData = data as AssistantResponse;
            setResponse(assistantData);
            setMessages((current) => [...current, { role: "assistant", text: assistantData.answer }]);
        } catch (error) {
            const text = error instanceof Error ? error.message : "Unable to reach the help assistant right now.";
            setMessages((current) => [...current, { role: "assistant", text }]);
            setResponse(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                type="button"
                aria-label="Open help assistant"
                onClick={() => setIsOpen((current) => !current)}
                className="fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-full border border-white/15 bg-slate-950/90 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-slate-900"
            >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950">
                    <LifeBuoy className="h-5 w-5" />
                </span>
                <span className="hidden sm:inline">Need help?</span>
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-5 z-[85] w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220]/95 text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.65)] backdrop-blur-2xl">
                    <div className="border-b border-white/10 bg-gradient-to-r from-amber-300/15 via-orange-400/10 to-transparent px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-200/80">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Support Assistant
                                </div>
                                <h2 className="mt-2 text-lg font-semibold">Guidance before the handoff</h2>
                                <p className="mt-1 text-sm text-slate-300">
                                    Ask a question, review the closest guide, then escalate to support if the issue still blocks you.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close help assistant"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                            {HELP_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => submitQuery(prompt)}
                                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-xs text-slate-200 transition hover:border-amber-300/40 hover:bg-white/[0.06]"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            {messages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                        message.role === "assistant"
                                            ? "bg-white/[0.04] text-slate-200"
                                            : "ml-auto max-w-[85%] bg-amber-300 text-slate-950"
                                    }`}
                                >
                                    {message.text}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                                    Looking up the closest guide...
                                </div>
                            )}
                        </div>

                        {response && (
                            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                                {response.matches.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Closest guides</p>
                                        {response.matches.map((match) => (
                                            <Link
                                                key={match.slug}
                                                href={match.href}
                                                className="block rounded-2xl border border-white/10 px-4 py-3 transition hover:border-amber-300/40 hover:bg-white/[0.04]"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="font-medium text-slate-100">{match.title}</h3>
                                                    <span className="text-xs uppercase tracking-[0.18em] text-amber-200/80">{match.category}</span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-300">{match.summary}</p>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {response.actions.map((action) =>
                                        action.kind === "mailto" ? (
                                            <a
                                                key={`${action.kind}-${action.href}`}
                                                href={action.href}
                                                className="inline-flex items-center rounded-full border border-white/10 px-3 py-2 text-sm text-slate-100 transition hover:border-amber-300/40 hover:bg-white/[0.04]"
                                            >
                                                {action.label}
                                            </a>
                                        ) : (
                                            <Link
                                                key={`${action.kind}-${action.href}`}
                                                href={action.href}
                                                className="inline-flex items-center rounded-full border border-white/10 px-3 py-2 text-sm text-slate-100 transition hover:border-amber-300/40 hover:bg-white/[0.04]"
                                            >
                                                {action.label}
                                            </Link>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitQuery(query);
                        }}
                        className="border-t border-white/10 px-5 py-4"
                    >
                        <label htmlFor="support-assistant-query" className="sr-only">
                            Ask the support assistant
                        </label>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                            <MessageSquare className="h-4 w-4 text-slate-400" />
                            <input
                                id="support-assistant-query"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Ask about setup, billing, imports, or keys"
                                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
