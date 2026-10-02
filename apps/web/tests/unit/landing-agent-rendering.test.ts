import { describe, expect, it } from "vitest";
import { getLandingRenderPayload, renderSectionsToHtml } from "@/modules/landing-agent/rendering";

describe("landing-agent rendering", () => {
    it("turns selected wireframe sections into renderable landing HTML", () => {
        const sections = [
            {
                id: "hero",
                type: "hero",
                heading: "Reduce manual outreach work",
                body: "Launch governed funnels faster.",
                ctaLabel: "Book a demo",
            },
            {
                id: "benefits",
                type: "benefits",
                heading: "Benefits",
                bullets: ["Audit-ready execution", "Cleaner attribution"],
            },
        ];

        const html = renderSectionsToHtml(sections);
        expect(html).toContain("Reduce manual outreach work");
        expect(html).toContain("Audit-ready execution");
        expect(html).toContain("href=\"#lead-form\"");
    });

    it("escapes section content before rendering public markup", () => {
        const payload = getLandingRenderPayload([
            {
                id: "hero",
                type: "hero",
                heading: "<script>alert('x')</script>",
                body: "javascript:alert('x')",
            },
        ]);

        expect(payload.html).not.toContain("<script>");
        expect(payload.html).toContain("&lt;script&gt;");
        expect(payload.css).toContain(".la-section");
    });
});

describe("section button links (creator funnel sales page)", () => {
    const html = (ctaHref: unknown) => renderSectionsToHtml([
        { id: "hero", type: "hero", heading: "Hi", ctaLabel: "Book", ctaHref },
        { id: "cta", type: "cta_form", heading: "Go", ctaHref },
    ]);

    it("opens the section's https link instead of the lead form", () => {
        const out = html("https://cal.example/me?a=1&b=2");
        expect(out).toContain('href="https://cal.example/me?a=1&amp;b=2"');
        expect(out).not.toContain('href="#lead-form"');
    });

    it("keeps the lead form for anything that isn't an https link", () => {
        for (const bad of ["javascript:alert(1)", "http://plain.example", "/relative", '" onclick="x', undefined]) {
            const out = html(bad);
            expect(out.match(/href="#lead-form"/g)).toHaveLength(2);
            expect(out).not.toContain("onclick");
        }
    });
});
