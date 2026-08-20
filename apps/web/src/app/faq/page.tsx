import { getContent } from "@/lib/cms";
import ReactMarkdown from "react-markdown";
import { HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FAQ & Governed Pipeline Architecture | CraftMyFunnel",
    description: "Frequently asked questions for B2B operators running governed outbound workflows, buyer intent signals, and human-in-the-loop approval queues.",
};

export default function FAQPage() {
    let title = "Frequently Asked Questions";
    let sections: { title: string; body: string }[] = [];

    try {
        const { metadata: cmsMeta, content } = getContent("faq/general.md");
        if (cmsMeta['title']) {
            title = cmsMeta['title'];
        }

        // Split sections by '###' header notation
        sections = content
            .split("###")
            .filter(Boolean)
            .map((section) => {
                const lines = section.trim().split("\n");
                const sectionTitle = lines[0]?.trim() || "";
                const sectionBody = lines.slice(1).join("\n").trim();
                return { title: sectionTitle, body: sectionBody };
            })
            .filter((s) => s.title && s.body);
    } catch (error) {
        console.error("CMS failed to load FAQ content, falling back to empty state", error);
    }

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": sections.map((s) => ({
            "@type": "Question",
            "name": s.title,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": s.body
            }
        }))
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />

            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Platform Knowledge
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                        {title}
                    </h1>
                    <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                        Clear answers on governed outreach, buyer signals, human review queues, and deliverability guardrails. Built for operators.
                    </p>
                </div>

                {/* FAQ Accordions / Cards */}
                <div className="space-y-4">
                    {sections.length > 0 ? (
                        sections.map((section, idx) => (
                            <div
                                key={idx}
                                className="p-6 sm:p-7 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                            >
                                <h2 className="text-lg font-bold text-white flex items-start gap-3">
                                    <span className="text-blue-400 font-mono text-sm shrink-0 mt-0.5">{String(idx + 1).padStart(2, "0")}.</span>
                                    <span>{section.title}</span>
                                </h2>
                                <div className="pl-7 text-sm text-slate-300 leading-relaxed prose prose-invert prose-p:my-1.5 prose-strong:text-white prose-ul:my-2">
                                    <ReactMarkdown>{section.body}</ReactMarkdown>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-400">No questions configured yet.</p>
                    )}
                </div>

                {/* CTA Card */}
                <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-center space-y-5">
                    <h3 className="text-2xl font-extrabold text-white">
                        Have a specific pipeline architecture question?
                    </h3>
                    <p className="text-sm text-slate-300 max-w-lg mx-auto">
                        Speak directly with an outbound engineer or explore our technical architecture guides.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/docs"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Read Documentation
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Contact Engineering
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
