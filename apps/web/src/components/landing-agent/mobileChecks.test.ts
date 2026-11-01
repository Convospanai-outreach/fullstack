import { describe, expect, it } from "vitest";
import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";
import { LEAD_FORM_MARKER_CLASS, encodeLeadFormMarkerId } from "@/modules/landing-agent/leadFormConfig";
import { mobilePageWarnings, type MobileCheckInput } from "./mobileChecks";

const FORM_MARKER = `<div class="${LEAD_FORM_MARKER_CLASS}" id="${encodeLeadFormMarkerId({
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks!",
})}"></div>`;

// Base CSS plus a CTA padded enough to reach 44px (the base .la-cta is about 41px).
const PADDED_CTA_CSS = `${LANDING_PAGE_BASE_CSS}\n.la-cta { padding: 14px 20px; }`;

function kinds(input: MobileCheckInput): string[] {
    return mobilePageWarnings(input).map((w) => w.kind);
}

describe("mobilePageWarnings: body text size", () => {
    it("warns when body text is under 16px and names the smallest size", () => {
        const warnings = mobilePageWarnings({
            html: `<section class="la-section"><p id="note">Read me</p>${FORM_MARKER}</section>`,
            css: `${LANDING_PAGE_BASE_CSS}\n#note { font-size: 14px; }`,
        });
        expect(warnings.map((w) => w.kind)).toEqual(["small_text"]);
        expect(warnings[0].message).toContain("14px");
    });

    it("applies @media rules that match the 390px phone preview", () => {
        const html = `<section class="la-section"><p id="note">Read me</p>${FORM_MARKER}</section>`;
        expect(kinds({ html, css: `${LANDING_PAGE_BASE_CSS}\n@media (max-width: 720px) { #note { font-size: 12px; } }` })).toEqual(["small_text"]);
        // A rule only for wider screens does not apply to the phone preview.
        expect(kinds({ html, css: `${LANDING_PAGE_BASE_CSS}\n@media (min-width: 1024px) { #note { font-size: 12px; } }` })).toEqual([]);
    });

    it("follows the cascade: an id rule beats a tag-and-class rule, and a later equal rule wins", () => {
        const html = `<section class="la-section"><p id="note">Read me</p>${FORM_MARKER}</section>`;
        // .la-section p (0,1,1) would give 18px, but #note (1,0,0) gives 14px: warn.
        expect(kinds({ html, css: `${LANDING_PAGE_BASE_CSS}\n#note { font-size: 14px; }\n.la-section p { font-size: 18px; }` })).toEqual(["small_text"]);
        // Two equal id rules: the later one (18px) wins, no warning.
        expect(kinds({ html, css: `${LANDING_PAGE_BASE_CSS}\n#note { font-size: 14px; }\n#note { font-size: 18px; }` })).toEqual([]);
    });
});

describe("mobilePageWarnings: tap targets", () => {
    it("warns when a button is under 44px tall", () => {
        const warnings = mobilePageWarnings({
            html: `<section class="la-section"><a class="la-cta" href="#lead-form">Book a demo</a>${FORM_MARKER}</section>`,
            css: `${LANDING_PAGE_BASE_CSS}
.la-cta { padding: 11px 16px; }`,
        });
        expect(warnings.map((w) => w.kind)).toEqual(["small_tap_target"]);
        expect(warnings[0].message).toContain("44px");
    });

    it("does not warn for the base button in the published CSS", () => {
        const html = `<section class="la-section"><a class="la-cta" href="#lead-form">Book a demo</a>${FORM_MARKER}</section>`;
        expect(kinds({ html, css: LANDING_PAGE_BASE_CSS })).toEqual([]);
    });

    it("does not warn when the button is padded to 44px or more", () => {
        const html = `<section class="la-section"><a class="la-cta" href="#lead-form">Book a demo</a>${FORM_MARKER}</section>`;
        expect(kinds({ html, css: PADDED_CTA_CSS })).toEqual([]);
    });

    it("uses an explicit min-height when it is larger than the padding estimate", () => {
        const html = `<section class="la-section"><a class="la-cta" href="#lead-form">Book a demo</a>${FORM_MARKER}</section>`;
        expect(kinds({ html, css: `${LANDING_PAGE_BASE_CSS}\n.la-cta { min-height: 48px; }` })).toEqual([]);
    });
});

describe("mobilePageWarnings: images", () => {
    const pageWith = (...srcs: string[]) =>
        `<section class="la-section">${srcs.map((src) => `<img src="${src}" alt="x" />`).join("")}${FORM_MARKER}</section>`;

    it("warns when the known image sizes on the page add up to more than 1 MB", () => {
        const warnings = mobilePageWarnings({
            html: pageWith("https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"),
            css: PADDED_CTA_CSS,
            imageBytes: { "https://cdn.example.com/a.jpg": 600_000, "https://cdn.example.com/b.jpg": 600_000 },
        });
        expect(warnings.map((w) => w.kind)).toEqual(["heavy_images"]);
        expect(warnings[0].message).toContain("1 MB");
        expect(warnings[0].message).toContain("this editor session");
    });

    it("does not warn when the known sizes stay under 1 MB", () => {
        expect(
            kinds({
                html: pageWith("https://cdn.example.com/a.jpg"),
                css: PADDED_CTA_CSS,
                imageBytes: { "https://cdn.example.com/a.jpg": 900_000 },
            })
        ).toEqual([]);
    });

    it("counts a repeated image once and ignores images whose size is not known", () => {
        expect(
            kinds({
                html: pageWith("https://cdn.example.com/a.jpg", "https://cdn.example.com/a.jpg", "https://cdn.example.com/unknown.jpg"),
                css: PADDED_CTA_CSS,
                imageBytes: { "https://cdn.example.com/a.jpg": 700_000 },
            })
        ).toEqual([]);
    });
});

describe("mobilePageWarnings: lead form", () => {
    it("warns when the page has no lead form block and says the default box is used", () => {
        const warnings = mobilePageWarnings({
            html: `<section class="la-section"><p>Hello</p></section>`,
            css: LANDING_PAGE_BASE_CSS,
        });
        expect(warnings.map((w) => w.kind)).toEqual(["no_lead_form"]);
        expect(warnings[0].message).toContain("Request a follow-up");
    });

    it("warns when the lead form marker has an invalid config (it renders nothing)", () => {
        const html = `<section class="la-section"><div class="${LEAD_FORM_MARKER_CLASS}" id="cmf-form-not-valid!"></div></section>`;
        expect(kinds({ html, css: PADDED_CTA_CSS })).toEqual(["no_lead_form"]);
    });
});

describe("mobilePageWarnings: clean page", () => {
    it("returns no warnings for a page that passes every check", () => {
        const html = `<section class="la-section la-hero"><p class="la-eyebrow">Your offer</p><h1>Headline</h1><p>Body copy.</p><a class="la-cta" href="#lead-form">Book a demo</a><img src="https://cdn.example.com/a.jpg" alt="Hero" />${FORM_MARKER}</section>`;
        expect(mobilePageWarnings({ html, css: PADDED_CTA_CSS, imageBytes: { "https://cdn.example.com/a.jpg": 200_000 } })).toEqual([]);
    });
});
