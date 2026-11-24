import { getContent } from "@/lib/cms";
import ReactMarkdown from "react-markdown";
import { Testimonials } from "@/components/marketing/Testimonials";
import { Page, PageHero, Section, CtaBand, JsonLd } from "@/components/marketing/site/kit";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FAQ & Governed Pipeline Architecture | CraftMyFunnel",
    description: "Frequently asked questions for B2B operators running governed outbound workflows, buyer intent signals, and human-in-the-loop approval queues.",
    alternates: {
        canonical: "https://craftmyfunnel.live/faq",
    },
    openGraph: {
        title: "CraftMyFunnel FAQ & Governed Pipeline Architecture",
        description: "Answers on governed outreach, buyer signals, human review queues, and deliverability guardrails.",
        url: "https://craftmyfunnel.live/faq",
        images: [
            {
                url: "/images/platform/governed-workflow.webp",
                width: 820,
                height: 460,
                alt: "Governed Outbound Architecture FAQ",
            }
        ],
    },
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
        <Page>
            <JsonLd data={faqSchema} />
            <PageHero eyebrow="FAQ" title={title} lead="Clear answers on governed outreach, buyer signals, human review and deliverability." />
            <Section tone="light">
                {sections.length > 0 ? (
                    <div className="ph-faq">
                        {sections.map((section) => (
                            <details key={section.title}>
                                <summary>{section.title}</summary>
                                <div className="ph-prose" style={{ marginTop: 12 }}><ReactMarkdown>{section.body}</ReactMarkdown></div>
                            </details>
                        ))}
                    </div>
                ) : <p className="ph-lead">No questions configured yet.</p>}
            </Section>
            <Testimonials />
            <CtaBand title="Have a specific question?" lead="Talk to our team or read the docs." primary={{ label: "Contact us", href: "/contact" }} secondary={{ label: "Read the docs", href: "/docs" }} />
        </Page>
    );
}
