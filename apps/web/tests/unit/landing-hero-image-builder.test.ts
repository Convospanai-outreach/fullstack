import { describe, expect, it } from "vitest";

import { buildHeroImageHtml } from "@/components/landing-agent/heroImageBlock";

const base = { src: "/landing-assets/gradient-1.svg", alt: "Blue wave", focal: "center" as const, darken: 40 as const };

describe("buildHeroImageHtml", () => {
    it.each(["background", "side", "top"] as const)("%s layout carries the image src, alt and focal class", (layout) => {
        const out = buildHeroImageHtml({ ...base, layout });
        expect(out).not.toBeNull();
        expect(out).toContain('src="/landing-assets/gradient-1.svg"');
        expect(out).toContain('alt="Blue wave"');
        expect(out).toContain("la-focus-center");
    });

    it("the background layout has the overlay class", () => {
        const out = buildHeroImageHtml({ ...base, layout: "background" })!;
        expect(out).toContain('class="la-overlay la-overlay-40"');
    });

    it("no overlay element is added when darken is 0", () => {
        const html = buildHeroImageHtml({ ...base, layout: "background", darken: 0 })!;
        expect(html).not.toContain("la-overlay");
    });

    it("refuses a javascript:, data: or http: image", () => {
        for (const src of ["javascript:alert(1)", "data:image/png;base64,AAAA", "http://images.example.com/a.jpg"]) {
            expect(buildHeroImageHtml({ ...base, src, layout: "side" })).toBeNull();
        }
    });

    it("refuses an empty or blank alt text", () => {
        expect(buildHeroImageHtml({ ...base, alt: "", layout: "top" })).toBeNull();
        expect(buildHeroImageHtml({ ...base, alt: "   ", layout: "top" })).toBeNull();
    });

    it("escapes quotes and angle brackets in alt text so they cannot start an attribute", () => {
        const html = buildHeroImageHtml({ ...base, alt: 'x" onerror="alert(1)', layout: "side" })!;
        expect(html).not.toMatch(/"\s*onerror=/);
        expect(html).toContain("alt=\"x&quot; onerror=&quot;alert(1)\"");
    });

    it("uses classes only, never inline style or url()", () => {
        for (const layout of ["background", "side", "top"] as const) {
            const html = buildHeroImageHtml({ ...base, layout })!;
            expect(html).not.toMatch(/\sstyle\s*=/i);
            expect(html).not.toMatch(/url\(/i);
        }
    });
});
