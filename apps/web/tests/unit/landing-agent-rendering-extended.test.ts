import { describe, expect, it } from "vitest";
import {
    LANDING_PAGE_BASE_CSS,
    getLandingRenderPayload,
    renderSectionsToHtml,
    withLandingBaseCss,
} from "@/modules/landing-agent/rendering";

describe("landing-agent rendering extended behavior", () => {
    it("returns fallback markup and base css for empty or invalid payloads", () => {
        expect(renderSectionsToHtml(null)).toContain("Landing page unavailable");
        expect(renderSectionsToHtml({ sections: [] })).toContain("Landing page unavailable");
        expect(getLandingRenderPayload("not-json")).toEqual({
            html: expect.stringContaining("Landing page unavailable"),
            css: LANDING_PAGE_BASE_CSS,
        });
    });

    it("wraps custom css unless it already contains the base section styles", () => {
        expect(withLandingBaseCss("")).toBe(LANDING_PAGE_BASE_CSS);
        expect(withLandingBaseCss(".custom { color: red; }")).toContain(".la-section");
        expect(withLandingBaseCss(".la-section { padding: 0; }")).toBe(".la-section { padding: 0; }");
    });

    it("renders hero, cta form, footer, and generic sections from nested section payloads", () => {
        const html = getLandingRenderPayload({
            sections: [
                { id: "hero main", type: "hero", heading: "Hero", body: "Body", ctaLabel: "Start" },
                { id: "form", type: "cta_form", heading: "Ready?", body: "Talk to us" },
                { id: "footer", type: "footer", heading: "Footer", ctaLabel: "Contact" },
                { id: "proof", type: "social_proof", heading: "", bullets: ["One", "<Two>"] },
            ],
        }).html;

        expect(html).toContain('id="hero-main"');
        expect(html).toContain('data-section-type="hero"');
        expect(html).toContain("Request a follow-up");
        expect(html).toContain("la-footer");
        expect(html).toContain("social proof");
        expect(html).toContain("&lt;Two&gt;");
    });

    it("sanitizes raw html payloads while preserving safe markup", () => {
        const payload = getLandingRenderPayload({
            html: `
                <!-- remove me -->
                <script>alert(1)</script>
                <style>.bad {}</style>
                <iframe src="https://evil.test"></iframe>
                <section onclick="evil()" style="color:red" class="hero bad@class" data-section-type="hero">
                    <a href="javascript:alert(1)" target="_blank" rel="evil">bad</a>
                    <a href="https://example.test/demo" target="_blank">good</a>
                    <a href="mailto:sales@example.test">mail</a>
                    <p data-unsafe="drop" title="">empty title</p>
                    <custom-tag data-x="1">gone</custom-tag>
                </section>
            `,
            css: ".custom { display: block; }",
        });

        expect(payload.html).not.toContain("<script");
        expect(payload.html).not.toContain("<style");
        expect(payload.html).not.toContain("<iframe");
        expect(payload.html).not.toContain("onclick");
        expect(payload.html).not.toContain("data-unsafe");
        expect(payload.html).not.toContain('title=""');
        expect(payload.html).not.toContain("javascript:");
        expect(payload.html).toContain('class="hero badclass"');
        expect(payload.html).toContain('href="https://example.test/demo"');
        expect(payload.html).toContain('target="_blank" rel="noopener noreferrer"');
        expect(payload.html).toContain('href="mailto:sales@example.test"');
        expect(payload.html).toContain("gone");
        expect(payload.css).toContain(".la-section");
        expect(payload.css).toContain(".custom");
    });
});
