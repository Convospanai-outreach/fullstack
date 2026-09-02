import { describe, expect, it } from "vitest";
import { getLandingRenderPayload } from "./rendering";

describe("getLandingRenderPayload image handling", () => {
    it("renders an <img> for a hero section with a safe https imageUrl", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", imageUrl: "https://pages.example.com/assets/hero.png" },
        ]);
        expect(html).toContain('<img src="https://pages.example.com/assets/hero.png"');
    });

    it("renders an <img> for a hero section with a relative /assets/ imageUrl", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", imageUrl: "/assets/hero.png" },
        ]);
        expect(html).toContain('<img src="/assets/hero.png"');
    });

    it("strips a javascript: imageUrl", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", imageUrl: "javascript:alert(1)" },
        ]);
        expect(html).not.toContain("<img");
        expect(html).not.toContain("javascript:");
    });

    it("strips a data: imageUrl", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", imageUrl: "data:text/html,<script>alert(1)</script>" },
        ]);
        expect(html).not.toContain("<img");
    });

    it("strips a data: src on a raw html/css payload too", () => {
        const { html } = getLandingRenderPayload({
            html: '<section><img src="data:text/html,evil" alt="x" /></section>',
            css: "",
        });
        expect(html).not.toContain("data:");
    });

    it("still renders sections without an imageUrl (no regression to plain pages)", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", body: "No image here" },
        ]);
        expect(html).toContain("Welcome");
        expect(html).not.toContain("<img");
    });
});
