import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_PAGE_BASE_CSS, sanitizeRenderedJsonHtml } from "./rendering";

// The editor's hero image markup lives in apps/web; its test writes the exact markup to this
// fixture. Here it goes through the real sanitizer: classes, the image and its alt text must survive.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/hero-image-markup.json"), "utf8")) as {
    blocks: Record<string, string>;
    built: Record<string, string>;
};

function sanitize(html: string): string {
    return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

// Whitespace-insensitive, so the check is about structure and not indentation.
function normalize(html: string): string {
    return html.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

describe("hero image markup through the sanitizer", () => {
    const all = [...Object.entries(fixture.blocks), ...Object.entries(fixture.built)];

    it("has the three blocks and the three builder layouts", () => {
        expect(Object.keys(fixture.blocks).sort()).toEqual(["hero_image_background", "hero_image_split", "hero_image_top"]);
        expect(Object.keys(fixture.built).sort()).toEqual(["background", "side", "top"]);
    });

    it.each(all)("%s keeps its structure", (_name, html) => {
        expect(normalize(sanitize(html))).toBe(normalize(html));
    });

    it.each(all)("%s keeps the image src and a non-empty alt", (_name, html) => {
        const out = sanitize(html);
        const tags = out.match(/<img[^>]*>/gi) ?? [];
        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) {
            expect(/\ssrc="\/landing-assets\/[^"]+"/.test(tag)).toBe(true);
            expect((/\salt="([^"]*)"/.exec(tag)?.[1] ?? "").trim().length).toBeGreaterThan(0);
        }
    });

    it("keeps the overlay and focal classes", () => {
        const out = sanitize(fixture.blocks["hero_image_background"]!);
        expect(out).toContain("la-overlay la-overlay-40");
        expect(out).toContain("la-focus-center");
    });
});

describe("base CSS", () => {
    it("defines every overlay and focal class", () => {
        for (const cls of ["la-overlay-20", "la-overlay-40", "la-overlay-60", "la-focus-top", "la-focus-center", "la-focus-bottom"]) {
            expect(LANDING_PAGE_BASE_CSS).toContain(`.${cls} {`);
        }
    });

    it("is the same text as the web copy the editor canvas uses", () => {
        const webSource = readFileSync(resolve(WEB, "src/modules/landing-agent/rendering.ts"), "utf8").replace(/\r\n/g, "\n");
        expect(webSource).toContain(LANDING_PAGE_BASE_CSS.replace(/\r\n/g, "\n"));
    });
});
