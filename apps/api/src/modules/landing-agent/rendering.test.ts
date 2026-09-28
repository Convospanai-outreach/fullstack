import { describe, expect, it } from "vitest";
import { getLandingRenderPayload, renderSectionsToHtml, sanitizeRenderedJsonHtml } from "./rendering";

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

// S-09 (roadmap 3.3): the raw-html path runs through DOMPurify (jsdom) instead of
// a hand-rolled tokenizer. Payloads below are real XSS vectors; the last two
// tests pin parser-level behaviour the hand-rolled scanner did not provide.
describe("getLandingRenderPayload DOMPurify sanitizer (S-09)", () => {
    const sanitize = (html: string) => getLandingRenderPayload({ html, css: "" }).html;

    it.each([
        ["script element", "<p>a</p><script>alert(1)</script><p>b</p>"],
        ["img onerror", '<img src="https://x.test/a.png" onerror="alert(1)">'],
        ["anchor onclick", '<a href="https://x.test" onclick="alert(1)">x</a>'],
        ["unquoted handler", "<p onmouseover=alert(1)>x</p>"],
        ["javascript: href", '<a href="javascript:alert(1)">x</a>'],
        ["entity-encoded javascript: href", '<a href="jav&#x61;script:alert(1)">x</a>'],
        ["tab-split javascript: href", '<a href="java\tscript:alert(1)">x</a>'],
        ["svg script", "<svg><script>alert(1)</script></svg>"],
        ["svg onload", '<svg onload="alert(1)"><a href="javascript:alert(1)">y</a></svg>'],
        ["math mXSS", "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>"],
        ["math href", '<math href="javascript:alert(1)"><mi>x</mi></math>'],
        ["iframe/object/embed", '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="x">'],
        ["form phishing", '<form action="https://evil.test"><input name="password"><button>go</button></form>'],
        ["style attribute", '<p style="background:url(javascript:alert(1))">s</p>'],
        ["data: image", '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">'],
        ["template", "<template><img src=x onerror=alert(1)></template>"],
    ])("neutralises %s", (_label, payload) => {
        const html = sanitize(payload).toLowerCase();
        expect(html).not.toContain("<script");
        expect(html).not.toMatch(/\son[a-z]+\s*=/);
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("<svg");
        expect(html).not.toContain("<math");
        expect(html).not.toMatch(/<(iframe|object|embed|form|input|button|template|style)\b/);
        expect(html).not.toContain("style=");
        expect(html).not.toContain("data:");
    });

    it("keeps a legitimate rendered landing page unchanged", () => {
        const legit = renderSectionsToHtml([
            { id: "hero", type: "hero", heading: "Grow pipeline 3x", body: "AI outreach & scoring", ctaLabel: "Book a demo", imageUrl: "https://cdn.example.com/hero.png" },
            { id: "proof", type: "proof", heading: "Trusted by 200 teams", bullets: ["SOC 2", "GDPR <ready>"] },
            { id: "cta", type: "cta_form", heading: "Next step", body: "Talk to us" },
            { id: "footer", type: "footer", heading: "Acme", body: "(c) 2026" },
        ]);
        // Only difference: the parser serializes void elements as <img ...> not <img ... />.
        expect(sanitize(legit)).toBe(legit.trim().replace(/ \/>/g, ">"));
    });

    it("keeps editor (GrapesJS-style) markup in substance", () => {
        const html = sanitize(
            '<body><section id="i3kd" class="la-section la-hero" data-section-type="hero"><h1 id="ix9f">Big <strong>bold</strong> <em>claim</em></h1>' +
                '<p>Line one<br/>two &amp; more</p><a href="https://acme.test/pricing" target="_blank" class="la-cta">Pricing</a> ' +
                '<a href="mailto:hi@acme.test">Mail</a> <a href="tel:+15551234">Call</a> <a href="#lead-form">Go</a>' +
                '<img src="/assets/team/abc.png" alt="Team photo" loading="lazy" width="600" height="400"/></section>' +
                '<ol><li><small>two</small></li></ol><h2 title="t" aria-label="lbl">H2</h2></body>'
        );
        expect(html).toContain('<section id="i3kd" class="la-section la-hero" data-section-type="hero">');
        expect(html).toContain('<h1 id="ix9f">Big <strong>bold</strong> <em>claim</em></h1>');
        expect(html).toContain("<p>Line one<br>two &amp; more</p>");
        expect(html).toContain('href="https://acme.test/pricing"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('<a href="mailto:hi@acme.test">Mail</a>');
        expect(html).toContain('<a href="tel:+15551234">Call</a>');
        expect(html).toContain('<a href="#lead-form">Go</a>');
        expect(html).toContain('<img src="/assets/team/abc.png" alt="Team photo" loading="lazy" width="600" height="400">');
        expect(html).toContain("<ol><li><small>two</small></li></ol>");
        expect(html).toContain('<h2 title="t" aria-label="lbl">H2</h2>');
        expect(html).not.toContain("<body");
    });

    it("drops a raw rel and normalises target", () => {
        expect(sanitize('<a href="https://x.test" rel="opener" target="_top">x</a>')).toBe(
            '<a href="https://x.test" target="_self">x</a>'
        );
    });

    // Fails on the old tokenizer: it matched the first ">" even inside a quoted
    // attribute, so markup hidden in an attribute value re-emerged as a real
    // <img> element (a parser differential - the class of bug DOMPurify avoids).
    it("does not let markup inside a quoted attribute become an element (noscript mXSS)", () => {
        expect(sanitize('<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>')).not.toContain("<img");
    });

    // Fails on the old tokenizer: it kept ids that clobber window/document
    // globals, which matters on the app's own origin (/p/[slug]).
    it("strips DOM-clobbering ids", () => {
        const html = sanitize('<p id="cookie">c</p><img id="location" src="/a.png"><p id="hero-1">ok</p>');
        expect(html).not.toContain('id="cookie"');
        expect(html).not.toContain('id="location"');
        expect(html).toContain('id="hero-1"');
    });
});

describe("sanitizeRenderedJsonHtml (public page JSON for /p/[slug])", () => {
    it("sanitizes only the raw html field and keeps the rest", () => {
        const out = sanitizeRenderedJsonHtml({ html: "<p>hi</p><img src=x onerror=alert(1)><svg onload=alert(1)>", css: "p{}", sections: [] });
        expect(out).toEqual({ html: "<p>hi</p><img>", css: "p{}", sections: [] });
    });

    it("passes section arrays and non-html payloads through", () => {
        const sections = [{ type: "hero", heading: "x" }];
        expect(sanitizeRenderedJsonHtml(sections)).toBe(sections);
        expect(sanitizeRenderedJsonHtml({ sections })).toEqual({ sections });
        expect(sanitizeRenderedJsonHtml(null)).toBeNull();
    });
});
