import SectionTitle from "../../components/SectionTitle";
import GlassCard from "../../components/GlassCard";
import { getContent } from "../../lib/cms";
import ReactMarkdown from "react-markdown";

export const metadata = {
    title: "FAQ | CraftMyFunnel",
    description: "Common questions about CraftMyFunnel's AI-managed outbound workflows.",
};

export default function FAQPage() {
    let title = "Common Questions, Personal Answers";
    let sections: { title: string; body: string }[] = [];

    try {
        const { metadata, content } = getContent("faq/general.md");
        if (metadata['title']) {
            title = metadata['title'];
        }

        // Split sections by '###' header notation
        sections = content
            .split("###")
            .filter(Boolean)
            .map((section) => {
                const lines = section.trim().split("\n");
                const sectionTitle = lines[0].trim();
                const sectionBody = lines.slice(1).join("\n").trim();
                return { title: sectionTitle, body: sectionBody };
            });
    } catch (error) {
        console.error("CMS failed to load FAQ content, falling back to empty state", error);
    }

    return (
        <div className="section pt-32 pb-20">
            <SectionTitle title={title} />
            <div className="grid gap-6 max-w-2xl mx-auto mt-12">
                {sections.length > 0 ? (
                    sections.map((section, idx) => (
                        <GlassCard key={idx} title={section.title}>
                            <div className="prose prose-invert text-gray-300">
                                <ReactMarkdown>{section.body}</ReactMarkdown>
                            </div>
                        </GlassCard>
                    ))
                ) : (
                    <p className="text-center text-gray-400">No questions configured yet.</p>
                )}
            </div>
        </div>
    );
}
