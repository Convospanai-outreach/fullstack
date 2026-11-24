import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePresidio from "@/components/marketing/home/HomePresidio";
import { ProductPage, productMetadata } from "@/components/marketing/site/ProductPage";
import IndustriesPage from "@/app/industries/page";
import IndustryPage, { generateMetadata as industryMetadata } from "@/app/industries/[slug]/page";
import RegionPage, { generateMetadata as regionMetadata } from "@/app/regions/[slug]/page";
import { INDUSTRIES } from "@/lib/marketing/industries";
import { PRODUCTS } from "@/lib/marketing/products";
import { REGIONS } from "@/lib/marketing/regions";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("the public marketing pages render", () => {
    it("the home page", () => {
        expect(renderToStaticMarkup(<HomePresidio />)).toContain("<h1");
    });

    it("the industries index lists every industry", () => {
        const html = renderToStaticMarkup(<IndustriesPage />);
        for (const { slug } of INDUSTRIES) expect(html).toContain(`/industries/${slug}`);
    });

    it.each(INDUSTRIES.map((i) => i.slug))("industry %s", async (slug) => {
        expect(renderToStaticMarkup(await IndustryPage(params(slug)))).toContain("<h1");
        expect((await industryMetadata(params(slug))).title).toBeTruthy();
    });

    it.each(REGIONS.map((r) => r.slug))("region %s", async (slug) => {
        expect(renderToStaticMarkup(await RegionPage(params(slug)))).toContain("<h1");
        expect((await regionMetadata(params(slug))).title).toBeTruthy();
    });

    it.each(PRODUCTS.map((p) => p.slug))("product %s", (slug) => {
        expect(renderToStaticMarkup(<ProductPage slug={slug} />)).toContain("<h1");
        expect(productMetadata(slug).title).toBeTruthy();
    });

    it("an unknown industry is a 404, not a blank page", async () => {
        await expect(IndustryPage(params("no-such-industry"))).rejects.toThrow("NEXT_NOT_FOUND");
    });
});
