import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_PAGE_BASE_CSS, sanitizeRenderedJsonHtml } from "./rendering";

// The editor's CTA blocks live in apps/web; its test writes the exact markup to this fixture.
// Here every block goes through the real sanitizer and must come back unchanged.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/cta-markup.json"), "utf8")) as {
    presets: string[];
    microCopy: string;
    blocks: Record<string, string>;
};

const VARIANT_CLASSES = ["la-cta-outline", "la-cta-mobile-full", "la-cta-wrap", "la-cta-micro", "la-cta-sticky"];

function sanitize(html: string): string {
    return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

// Whitespace-insensitive, so the check is about structure and not indentation.
function normalize(html: string): string {
    return html.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

describe("CTA markup through the sanitizer", () => {
    const all = Object.entries(fixture.blocks);

    it.each(all)("%s survives the sanitizer unchanged", (_name, html) => {
        expect(normalize(sanitize(html))).toBe(normalize(html));
    });

    it.each(all)("%s has only in-page or https/tel/mailto links", (_name, html) => {
        for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
            expect(tag).toMatch(/class="la-cta[ "]/);
            expect(/\shref="([^"]*)"/.exec(tag)?.[1]).toBe("#lead-form");
        }
    });

    it.each(all)("%s contains no script, inline style or url()", (_name, html) => {
        const out = sanitize(html);
        expect(out).not.toMatch(/<script|\sstyle\s*=|url\(/i);
    });

    it("the sticky bar is a class only, with no script and no inline style", () => {
        const out = sanitize(fixture.blocks["cta_sticky_bar"]!);
        expect(out).toContain('class="la-cta-sticky"');
        expect(out).not.toMatch(/<script|\sstyle\s*=/i);
    });

    it("the micro-copy line survives under the button", () => {
        expect(sanitize(fixture.blocks["cta_micro_copy"]!)).toContain(`<p class="la-cta-micro">${fixture.microCopy}</p>`);
    });

    it("no preset text contains a number or a result claim", () => {
        for (const text of fixture.presets) {
            expect(text).not.toMatch(/\d/);
            expect(text).not.toMatch(/guarantee|%|only|last chance|act now|results?|proven|%/i);
        }
    });

    it("the variant classes are defined in the API copy of the base CSS", () => {
        for (const cls of VARIANT_CLASSES) {
            expect(LANDING_PAGE_BASE_CSS).toContain(`.${cls} {`);
        }
    });

    it("the variant classes are defined identically in the web copy of the base CSS", () => {
        const webSource = readFileSync(resolve(WEB, "src/modules/landing-agent/rendering.ts"), "utf8").replace(/\r\n/g, "\n");
        expect(webSource).toContain(LANDING_PAGE_BASE_CSS.replace(/\r\n/g, "\n"));
    });
});
