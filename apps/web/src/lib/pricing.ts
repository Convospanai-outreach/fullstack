// Single source of truth for the three paid marketing tiers, so the /pricing
// page copy, its JSON-LD structured data, and the plan taxonomy can't drift into
// the three-conflicting-price-lists state F-02 flagged. Prices are in INR (the
// currency /billing/plans returns by default and the only currency currently
// seeded on Plan rows); the live per-visitor price still comes from the
// /billing/plans fetch at runtime, and real USD will flow through once
// Plan.stripePrices is populated. `dbName` matches the Plan.name rows and the
// checkout PLAN_ALIASES table (apps/api/routes/billing/checkout/route.ts).

export type PricingTier = {
    /** Internal marketing key used by the pricing page's checkout handler. */
    name: "Starter" | "Growth" | "Enterprise";
    /** Real Plan.name row (and checkout alias target). */
    dbName: "PRO" | "GROWTH" | "ENTERPRISE";
    /** Customer-facing tier name (shown on the page and in JSON-LD). */
    displayName: string;
    description: string;
    /** Monthly price in whole INR rupees. */
    inrMonthly: number;
    credits: number;
};

export const PRICING_TIERS: PricingTier[] = [
    {
        name: "Starter",
        dbName: "PRO",
        displayName: "Pilot",
        description: "30-day growth pilot package for one ICP, one geography, and one offer",
        inrMonthly: 49,
        credits: 500,
    },
    {
        name: "Growth",
        dbName: "GROWTH",
        displayName: "Growth Autopilot",
        description: "Monthly managed campaign operations for repeatable pipeline tracking",
        inrMonthly: 99,
        credits: 2500,
    },
    {
        name: "Enterprise",
        dbName: "ENTERPRISE",
        displayName: "Enterprise / Partner",
        description: "Custom vertical playbooks, governance, and private-data execution options",
        inrMonthly: 499,
        credits: 15000,
    },
];

const PRICING_URL = "https://craftmyfunnel.live/pricing";

/**
 * Builds the schema.org JSON-LD for the pricing page from the canonical tiers, in
 * one currency. Pure and deterministic so it can be unit-tested and statically
 * rendered (no DB / request access), which keeps /pricing a static route.
 */
export function buildPricingSchema(tiers: PricingTier[], currency = "INR") {
    const prices = tiers.map((t) => t.inrMonthly);
    // Math.min/max of an empty array are ±Infinity, which would emit invalid
    // structured data; clamp to 0 for the (today impossible) empty-tier case.
    const lowPrice = prices.length ? Math.min(...prices) : 0;
    const highPrice = prices.length ? Math.max(...prices) : 0;
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://craftmyfunnel.live" },
                    { "@type": "ListItem", "position": 2, "name": "Pricing", "item": PRICING_URL },
                ],
            },
            {
                "@type": "Product",
                "name": "CraftMyFunnel Outbound Automation Platform",
                "description": "Governed AI outreach and qualified meeting workflow automation platform for B2B service teams.",
                "brand": { "@type": "Brand", "name": "CraftMyFunnel" },
                "offers": {
                    "@type": "AggregateOffer",
                    "priceCurrency": currency,
                    "lowPrice": String(lowPrice),
                    "highPrice": String(highPrice),
                    "offerCount": String(tiers.length),
                    "offers": tiers.map((t) => ({
                        "@type": "Offer",
                        "name": t.displayName,
                        "price": String(t.inrMonthly),
                        "priceCurrency": currency,
                        "description": t.description,
                        "availability": "https://schema.org/InStock",
                        "url": PRICING_URL,
                    })),
                },
            },
        ],
    };
}
