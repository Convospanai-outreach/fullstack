import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing & Plans | CraftMyFunnel",
    description: "Transparent pricing for managed growth execution, campaign operations, and pipeline tracking. Pilot ($49), Growth Autopilot ($99), and Enterprise ($499) tiers.",
    alternates: {
        canonical: "https://craftmyfunnel.live/pricing",
    },
    openGraph: {
        title: "CraftMyFunnel Pricing & Plans",
        description: "Transparent pricing for governed B2B outreach: Pilot ($49), Growth ($99), Enterprise ($499).",
        url: "https://craftmyfunnel.live/pricing",
        images: [
            {
                url: "/images/platform/pricing-guarantee.webp",
                width: 820,
                height: 460,
                alt: "CraftMyFunnel Governed Pilot and Pricing Tiers",
            }
        ],
    },
};


const pricingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "CraftMyFunnel Outbound Platform Subscription",
    "description": "Governed B2B outreach and qualified meeting workflow platform with mandatory human-in-the-loop approvals and deliverability guardrails.",
    "brand": {
        "@type": "Brand",
        "name": "CraftMyFunnel"
    },
    "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "49",
        "highPrice": "499",
        "offerCount": "3",
        "offers": [
            {
                "@type": "Offer",
                "name": "Pilot Plan",
                "description": "30-day growth pilot package for one ICP, one geography, and one offer. 500 AI generation credits, approval-first sending flow, follow-up reporting.",
                "price": "49",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://craftmyfunnel.live/pricing"
            },
            {
                "@type": "Offer",
                "name": "Growth Autopilot Plan",
                "description": "Monthly managed campaign operations for repeatable pipeline tracking. 2,500 credits, multiple campaigns, vertical playbooks, approval governance.",
                "price": "99",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://craftmyfunnel.live/pricing"
            },
            {
                "@type": "Offer",
                "name": "Enterprise / Partner Plan",
                "description": "Custom vertical playbooks, team governance, private-data execution options, 15,000 credits, dedicated success support.",
                "price": "499",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://craftmyfunnel.live/pricing"
            }
        ]
    }
};

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
            />
            {children}
        </>
    );
}
