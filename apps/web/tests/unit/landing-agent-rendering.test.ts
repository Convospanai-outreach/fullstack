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
