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

    it("strips a nested/overlapping <scr<script>ipt> payload that a single-pass regex would miss", () => {
        const { html } = getLandingRenderPayload({
            html: '<section><scr<script>ipt>alert(1)</script>ipt></section>',
            css: "",
        });
        expect(html).not.toContain("<script");
    });

    it("strips a </script > closing tag with trailing whitespace before the angle bracket", () => {
        const { html } = getLandingRenderPayload({
            html: '<section><script>alert(1)</script ></section>',
            css: "",
        });
        expect(html).not.toContain("<script");
        expect(html).not.toContain("alert(1)");
    });

    it("strips a </script bar> closing tag carrying bogus trailing content", () => {
        const { html } = getLandingRenderPayload({
            html: '<section><script>alert(1)</script bar></section>',
            css: "",
        });
        expect(html).not.toContain("<script");
        expect(html).not.toContain("alert(1)");
    });

    it("still renders sections without an imageUrl (no regression to plain pages)", () => {
        const { html } = getLandingRenderPayload([
            { id: "hero", type: "hero", heading: "Welcome", body: "No image here" },
        ]);
        expect(html).toContain("Welcome");
        expect(html).not.toContain("<img");
    });
});

describe("getLandingRenderPayload css sanitization", () => {
    it("strips a </style> breakout in the css field so injected markup can't execute", () => {
        const { css } = getLandingRenderPayload({
            html: "<section>hi</section>",
            css: 'body{color:red}</style><img src=x onerror=alert(document.cookie)>',
        });
        expect(css.toLowerCase()).not.toContain("</style");
    });

    it("strips a case-varied </STYLE> breakout", () => {
        const { css } = getLandingRenderPayload({
            html: "<section>hi</section>",
            css: "body{color:red}</STYLE><script>alert(1)</script>",
        });
        expect(css.toLowerCase()).not.toContain("</style");
    });

    it("leaves ordinary CSS untouched", () => {
        const { css } = getLandingRenderPayload({
            html: "<section>hi</section>",
            css: ".la-section .hero { color: blue; }",
        });
        expect(css).toContain(".la-section .hero { color: blue; }");
    });
});
