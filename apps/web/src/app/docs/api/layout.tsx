import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "REST API & Webhooks Specification | CraftMyFunnel Docs",
    description: "Public developer API reference for programmatically creating leads, managing workflows, triggering knowledge searches, and listening to webhook events.",
    alternates: {
        canonical: "https://craftmyfunnel.live/docs/api",
    },
    openGraph: {
        title: "CraftMyFunnel Developer REST API & Webhooks Specification",
        description: "Interactive API reference for programmatically managing leads, workflows, and webhooks in CraftMyFunnel.",
        url: "https://craftmyfunnel.live/docs/api",
    },
};

const apiSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "CraftMyFunnel REST API & Webhooks Specification",
    "description": "Developer documentation and OpenAPI reference for integrating leads, triggering workflows, and managing outbound automation programmatically.",
    "author": {
        "@type": "Organization",
        "name": "CraftMyFunnel"
    },
    "publisher": {
        "@type": "Organization",
        "name": "CraftMyFunnel",
        "logo": {
            "@type": "ImageObject",
            "url": "https://craftmyfunnel.live/craftmyfunnel-logo.png"
        }
    },
    "mainEntityOfPage": "https://craftmyfunnel.live/docs/api"
};

export default function ApiDocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(apiSchema) }}
            />
            {children}
        </>
    );
}
