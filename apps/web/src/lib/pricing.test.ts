import { describe, it, expect } from "vitest";
import { PRICING_TIERS, buildPricingSchema } from "./pricing";

describe("buildPricingSchema", () => {
    it("emits one offer per tier, in INR, with prices derived from the tiers", () => {
        const schema = buildPricingSchema(PRICING_TIERS);
        const product = schema["@graph"].find((n: any) => n["@type"] === "Product") as any;
        const agg = product.offers;

        expect(agg.priceCurrency).toBe("INR");
        expect(agg.offers).toHaveLength(PRICING_TIERS.length);
        expect(agg.offerCount).toBe(String(PRICING_TIERS.length));

        agg.offers.forEach((offer: any, i: number) => {
            const tier = PRICING_TIERS[i]!;
            expect(offer.name).toBe(tier.displayName);
            expect(offer.price).toBe(String(tier.inrMonthly));
            expect(offer.priceCurrency).toBe("INR");
            expect(offer.description).toBe(tier.description);
        });
    });

    it("derives lowPrice/highPrice from the tier set, not hardcoded", () => {
        const schema = buildPricingSchema(PRICING_TIERS);
        const product = schema["@graph"].find((n: any) => n["@type"] === "Product") as any;
        const prices = PRICING_TIERS.map((t) => t.inrMonthly);

        expect(product.offers.lowPrice).toBe(String(Math.min(...prices)));
        expect(product.offers.highPrice).toBe(String(Math.max(...prices)));
    });

    it("does not emit Infinity for an empty tier set", () => {
        const schema = buildPricingSchema([]);
        const product = schema["@graph"].find((n: any) => n["@type"] === "Product") as any;
        expect(product.offers.lowPrice).toBe("0");
        expect(product.offers.highPrice).toBe("0");
        expect(product.offers.offerCount).toBe("0");
        expect(product.offers.offers).toEqual([]);
    });

    it("includes a breadcrumb and propagates a custom currency", () => {
        const schema = buildPricingSchema(PRICING_TIERS, "USD");
        const breadcrumb = schema["@graph"].find((n: any) => n["@type"] === "BreadcrumbList");
        const product = schema["@graph"].find((n: any) => n["@type"] === "Product") as any;

        expect(breadcrumb).toBeTruthy();
        expect(product.offers.priceCurrency).toBe("USD");
        expect(product.offers.offers.every((o: any) => o.priceCurrency === "USD")).toBe(true);
    });
});
