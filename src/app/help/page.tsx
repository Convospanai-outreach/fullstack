"use client";

import { useState } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";

type HelpArticle = { slug: string; title: string; category: string; content: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HelpPage() {
    const [query, setQuery] = useState("");
    const { data: articles } = useSWR<HelpArticle[]>(`/api/help/search?q=${query}`, fetcher);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

    const activeArticle = articles?.find(a => a.slug === selectedSlug) || (articles && articles.length > 0 ? articles[0] : null);

    return (
        <div className="h-screen flex flex-col pt-16 bg-gray-900 text-white">
            {/* Header / Search */}
            <div className="bg-gray-800 border-b border-gray-700 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-4">How can we help?</h1>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search guides, tutorials, and FAQs..."
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-6 py-4 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <span className="absolute right-6 top-4 text-2xl">🔍</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex max-w-6xl mx-auto w-full">
                {/* Sidebar List */}
                <aside className="w-80 border-r border-gray-700 overflow-y-auto p-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">
                        {query ? "Search Results" : "Topics"}
                    </h3>
                    <div className="space-y-1">
                        {articles?.map(article => (
                            <button
                                key={article.slug}
                                onClick={() => setSelectedSlug(article.slug)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${activeArticle?.slug === article.slug
                                    ? "bg-blue-600 text-white"
                                    : "hover:bg-gray-800 text-gray-300"
                                    }`}
                            >
                                <div className="font-medium">{article.title}</div>
                                <div className="text-xs opacity-70 mt-1">{article.category}</div>
                            </button>
                        ))}
                        {articles && articles.length === 0 && (
                            <div className="text-gray-500 text-center py-4">No results found.</div>
                        )}
                    </div>
                </aside>

                {/* Content Viewer */}
                <main className="flex-1 overflow-y-auto p-8 bg-gray-900/50">
                    {/* Contact Us Banner */}
                    <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <h4 className="text-blue-200 font-semibold">Still need help?</h4>
                            <p className="text-sm text-blue-400">Our support team is just a click away.</p>
                        </div>
                        <a href="mailto:support@convospan.com" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium">
                            Contact Us
                        </a>
                    </div>


                    {activeArticle ? (
                        <article className="prose prose-invert max-w-none">
                            <ReactMarkdown>{activeArticle.content}</ReactMarkdown>
                        </article>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            Select an article to view details
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
