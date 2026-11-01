import { describe, expect, it } from "vitest";
import { LANDING_TEMPLATES, materializeLandingTemplate } from "./landingTemplates";
import { findLeadFormMarkers, replaceLeadFormMarkers } from "./leadFormHtml";
import { getLandingRenderPayload, sanitizeRenderedJsonHtml } from "./rendering";

// Every template is checked the way a saved page is: materialized, then through the real
// sanitizer. The output must be unchanged, so nothing a template uses is silently dropped.

const ORIGIN = "https://app.example";

function sanitize(html: string): string {
    return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

// Whitespace-insensitive, so the check is about structure and not indentation.
function normalize(html: string): string {
    return html.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

// Copy that promises numbers, results, scarcity or a fake testimonial must not ship in a template.
const FORBIDDEN_COPY = [
    /lorem/i,
    /\bundefined\b/,
    /\d+\s*%/,
    /\bonly\s+\d+\b/i,
    /\bguarantee/i,
    /\bcountdown\b/i,
    /\bjust\s+\d+\b/i,
    /\bin\s+\d+\s+(minutes|days|hours)\b/i,
    /\bresults?\s+in\s+\d/i,
];

// The gallery's 11 templates: 7 Instagram-first and 4 converted from the AI wireframe set.
const EXPECTED_IDS = [
    "free-guide",
    "dm-keyword-offer",
    "webinar-signup",
    "discount-offer",
    "book-a-call",
    "waitlist-launch",
    "quiz-checklist",
    "saas-launch",
    "online-course",
    "agency-done-for-you",
    "local-business",
];

describe("landing template gallery set", () => {
    it("has exactly the 7 Instagram templates and the 4 converted AI templates", () => {
        expect(LANDING_TEMPLATES.map((t) => t.id).sort()).toEqual([...EXPECTED_IDS].sort());
    });
});

describe.each(LANDING_TEMPLATES.map((t) => [t.id, t] as const))("template %s", (_id, template) => {
    const { html } = materializeLandingTemplate(template, ORIGIN);

    it("passes the sanitizer round-trip unchanged", () => {
        expect(normalize(sanitize(html))).toBe(normalize(html));
    });

    it("keeps exactly one form marker", () => {
        expect(findLeadFormMarkers(sanitize(html))).toHaveLength(1);
    });

    it("gives every image a non-empty alt text and a built-in https source", () => {
        const tags = html.match(/<img\b[^>]*>/gi) ?? [];
        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) {
            const src = /\ssrc="([^"]*)"/.exec(tag)?.[1] ?? "";
            expect(src.startsWith(`${ORIGIN}/landing-assets/gradient-`)).toBe(true);
            expect(src).toMatch(/\/landing-assets\/gradient-[1-8]\.svg$/);
            expect((/\salt="([^"]*)"/.exec(tag)?.[1] ?? "").trim().length).toBeGreaterThan(0);
        }
    });

    it("has one or more calls to action, and every link is an in-page form anchor or https, tel or mailto", () => {
        const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1]!);
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
            expect(href === "#lead-form" || /^(https:\/\/|mailto:|tel:)/.test(href)).toBe(true);
        }
    });

    it("has no inline style, script, form, input, iframe or navigation element", () => {
        expect(html).not.toMatch(/\sstyle=/i);
        expect(html).not.toMatch(/<(script|form|input|iframe|nav|header|footer)\b/i);
    });

    it("has no forbidden claims in the visible copy", () => {
        const text = html.replace(/<[^>]+>/g, " ");
        for (const pattern of FORBIDDEN_COPY) {
            expect(text).not.toMatch(pattern);
        }
    });

    it("has a lead form whose fields are all keyed and labelled", () => {
        expect(template.leadForm.fields.length).toBeGreaterThan(0);
        for (const field of template.leadForm.fields) {
            expect(field.label.trim().length).toBeGreaterThan(0);
        }
    });
});

// The server render path (the one the Cloudflare page service uses) turns the marker into one form.
describe.each(LANDING_TEMPLATES.map((t) => [t.id, t] as const))("template %s on the server render path", (_id, template) => {
    const { html } = materializeLandingTemplate(template, ORIGIN);
    const rendered = replaceLeadFormMarkers(getLandingRenderPayload(sanitizeRenderedJsonHtml({ html, css: "" })).html, { slug: "test-page" });

    it("renders exactly one form", () => {
        expect(rendered.match(/<form\b/g) ?? []).toHaveLength(1);
    });

    it("never falls back to the unavailable page and leaves no raw marker", () => {
        expect(rendered).not.toContain("Landing page unavailable");
        expect(rendered).not.toMatch(/<div class="cmf-form" id="cmf-form-/);
    });
});

// A template must not send visitors to an address we do not control. The only links are in-page form anchors.
describe.each(LANDING_TEMPLATES.map((t) => [t.id, t] as const))("template %s links", (_id, template) => {
    it("has no external http or https href", () => {
        const hrefs = [...template.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
        const external = hrefs.filter((href) => /^https?:\/\//i.test(href));
        expect(external).toEqual([]);
    });
});

describe("specific template rules", () => {
    const byId = (id: string) => LANDING_TEMPLATES.find((t) => t.id === id)!;

    it("the DM keyword offer headline repeats the keyword idea", () => {
        expect(byId("dm-keyword-offer").html).toContain("You commented GUIDE. Here it is.");
    });

    it("the discount offer has no countdown and an editable plain end date", () => {
        const html = byId("discount-offer").html;
        expect(html).toMatch(/Offer ends:/);
        expect(html).not.toMatch(/countdown/i);
    });

    it("the book-a-call template points its button at the form on the page", () => {
        const html = byId("book-a-call").html;
        expect(html).toMatch(/<a class="la-cta" href="#lead-form">Book my free call<\/a>/);
        expect(byId("book-a-call").leadForm.fields.some((f) => f.type === "tel")).toBe(true);
    });

    it("the testimonial blocks say to add the customer's words", () => {
        for (const template of LANDING_TEMPLATES) {
            if (/Testimonial/.test(template.html)) {
                expect(template.html).toMatch(/Add your customer.s words here\./);
            }
        }
    });
});
