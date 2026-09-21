import type { Metadata } from "next";
import { PRICING_TIERS, buildPricingSchema } from "@/lib/pricing";

export const metadata: Metadata = {
    title: "Pricing & Plans | CraftMyFunnel",
    description: "Transparent pricing for managed growth execution, campaign operations, and pipeline tracking across Pilot, Growth Autopilot, and Enterprise tiers.",
    alternates: {
        canonical: "https://craftmyfunnel.live/pricing",
    },
    openGraph: {
        title: "CraftMyFunnel Pricing & Plans",
        description: "Transparent pricing for governed B2B outreach across Pilot, Growth, and Enterprise tiers.",
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

// One JSON-LD block for the page, built from the canonical tiers in INR (the
// source of truth /billing/plans returns by default). Previously this file and
// page.tsx each rendered a separate, hardcoded USD Product block - two conflicting
// structured-data lists on one URL (F-02). page.tsx's block is now removed.
const pricingSchema = buildPricingSchema(PRICING_TIERS);

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
