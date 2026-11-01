import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leadFormConfigSchema, encodeLeadFormMarkerId, decodeLeadFormMarkerId, LEAD_FORM_DEFAULT_CONSENT } from "./leadFormConfig";
import { templateLeadForm } from "./landingTemplates";
import { findLeadFormMarkers } from "./leadFormHtml";
import {
    LANDING_APP_ORIGIN_FALLBACK,
    LANDING_TEMPLATES,
    absoluteLandingAssetUrls,
    getLandingTemplate,
    landingAppOrigin,
    materializeLandingTemplate,
} from "./landingTemplates";

// The web copy of the template data (the gallery's cards) must match the API source of truth.
// The web app cannot import from apps/api, so the two files are compared here with fs.
const WEB_FIXTURE = resolve(__dirname, "../../../../web/tests/fixtures/landing-templates.json");

const BUILT_IN_IMAGES = Array.from({ length: 8 }, (_, i) => `/landing-assets/gradient-${i + 1}.svg`);

// Editor blocks (hero and image blocks) store relative built-in image paths. They must become absolute on
// publish, the same as template pages, or the image breaks on a customer's connected domain.
describe("built-in image URLs on publish", () => {
    const blockMarkup = ["landing-blocks-markup.json", "hero-image-markup.json"].flatMap(
        (name) => Object.values((JSON.parse(readFileSync(resolve(__dirname, "../../../../web/tests/fixtures", name), "utf8")) as { blocks: Record<string, unknown> }).blocks) as string[],
    );

    it("the editor block fixtures use relative built-in images (the case this rule fixes)", () => {
        expect(blockMarkup.some((html) => html.includes('src="/landing-assets/'))).toBe(true);
    });

    it("makes every built-in image src absolute on the app origin", () => {
        for (const html of blockMarkup) {
            const out = absoluteLandingAssetUrls(html, LANDING_APP_ORIGIN_FALLBACK);
            expect(out).not.toMatch(/src="\/landing-assets\//);
            for (const [, src] of html.matchAll(/src="\/landing-assets\/([^"]*)"/g)) {
                expect(out).toContain(`src="${LANDING_APP_ORIGIN_FALLBACK}/landing-assets/${src}"`);
            }
        }
    });

    it("keeps relative paths when there is no https origin (local development)", () => {
        const html = blockMarkup[0]!;
        expect(absoluteLandingAssetUrls(html, null)).toBe(html);
    });
});

describe("landing template data", () => {
    it("has unique ids and the copy fields every card needs", () => {
        const ids = LANDING_TEMPLATES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const template of LANDING_TEMPLATES) {
            expect(template.name.trim().length).toBeGreaterThan(0);
            expect(template.audience.trim().length).toBeGreaterThan(0);
            expect(template.description.trim().length).toBeGreaterThan(0);
            expect(template.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });

    it("uses only the built-in header images, two or three variants each", () => {
        for (const template of LANDING_TEMPLATES) {
            expect(template.imageVariants.length).toBeGreaterThanOrEqual(2);
            expect(template.imageVariants.length).toBeLessThanOrEqual(3);
            for (const image of template.imageVariants) {
                expect(BUILT_IN_IMAGES).toContain(image);
            }
        }
    });

    it("has a lead form config that validates", () => {
        for (const template of LANDING_TEMPLATES) {
            expect(leadFormConfigSchema.safeParse(template.leadForm).success).toBe(true);
        }
    });

    it("has a token where the form goes and nothing else unresolved", () => {
        for (const template of LANDING_TEMPLATES) {
            expect(template.html.split("{{LEAD_FORM}}").length - 1).toBe(1);
        }
    });
});

describe("materializeLandingTemplate", () => {
    it("every template form starts with the default consent box", () => {
        for (const template of LANDING_TEMPLATES) expect(templateLeadForm(template).consent).toEqual(LEAD_FORM_DEFAULT_CONSENT);
    });

    it.each(LANDING_TEMPLATES.map((t) => [t.id, t] as const))("%s gets exactly one form marker made by the encoder", (_id, template) => {
        const { html } = materializeLandingTemplate(template, "https://app.example");
        const markers = findLeadFormMarkers(html);
        expect(markers).toHaveLength(1);
        expect(markers[0]!.id).toBe(encodeLeadFormMarkerId(templateLeadForm(template)));
        expect(decodeLeadFormMarkerId(markers[0]!.id)).toEqual(templateLeadForm(template));
        expect(html).not.toContain("{{");
    });

    it("writes image URLs as absolute https URLs on the app origin", () => {
        const template = LANDING_TEMPLATES[0]!;
        const { html } = materializeLandingTemplate(template, "https://app.example");
        const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
        expect(srcs.length).toBeGreaterThan(0);
        for (const src of srcs) {
            expect(src.startsWith("https://app.example/landing-assets/")).toBe(true);
        }
    });

    it("keeps relative image paths when there is no https origin (local development)", () => {
        const template = LANDING_TEMPLATES[0]!;
        const { html, css } = materializeLandingTemplate(template, null);
        expect(html).toContain('src="/landing-assets/');
        expect(css).toBe("");
    });
});

describe("landingAppOrigin", () => {
    it("uses the site URL first, then NEXTAUTH_URL, as the web app does for its canonical origin", () => {
        expect(landingAppOrigin({ NEXT_PUBLIC_SITE_URL: "https://site.example/", NEXTAUTH_URL: "https://auth.example" })).toBe("https://site.example");
        expect(landingAppOrigin({ NEXTAUTH_URL: "https://auth.example/path" })).toBe("https://auth.example");
    });

    it("returns null for a plain http origin and the fallback when nothing is set", () => {
        expect(landingAppOrigin({ NEXTAUTH_URL: "http://localhost:3000" })).toBeNull();
        expect(landingAppOrigin({ NEXTAUTH_URL: "not a url" })).toBeNull();
        expect(landingAppOrigin({})).toBe(LANDING_APP_ORIGIN_FALLBACK);
    });
});

describe("getLandingTemplate", () => {
    it("finds a template by id and returns undefined for an unknown id", () => {
        const first = LANDING_TEMPLATES[0]!;
        expect(getLandingTemplate(first.id)).toEqual(first);
        expect(getLandingTemplate("no-such-template")).toBeUndefined();
    });
});

describe("drift: API and web copies of the template data", () => {
    it("the web fixture is identical to the API source of truth", () => {
        const web = JSON.parse(readFileSync(WEB_FIXTURE, "utf8")) as unknown;
        const api = JSON.parse(readFileSync(resolve(__dirname, "landingTemplates.json"), "utf8")) as unknown;
        expect(web).toEqual(api);
    });
});
