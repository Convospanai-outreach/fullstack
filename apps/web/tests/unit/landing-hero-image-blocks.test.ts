import { describe, expect, it } from "vitest";

import { EDITOR_BLOCKS } from "@/components/landing-agent/editorConfig";
import { classifyImageSource } from "@/components/landing-agent/imageSources";
import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";
import {
    LANDING_PAGE_BASE_CSS as API_LANDING_PAGE_BASE_CSS,
    sanitizeRenderedJsonHtml,
} from "../../../api/src/modules/landing-agent/rendering";

const HERO_IMAGE_BLOCK_IDS = ["hero_image_background", "hero_image_split", "hero_image_top"];
const heroBlocks = EDITOR_BLOCKS.filter((block) => HERO_IMAGE_BLOCK_IDS.includes(block.id));

// Collapses whitespace so the comparison checks structure, not indentation.
function normalize(html: string): string {
    return html.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

function sanitize(html: string): string {
    return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

function imageTags(html: string): string[] {
    return html.match(/<img[^>]*>/gi) ?? [];
}

describe("hero image blocks", () => {
    it("ships the three hero image layouts", () => {
        expect(heroBlocks.map((block) => block.id).sort()).toEqual([...HERO_IMAGE_BLOCK_IDS].sort());
    });

    it.each(HERO_IMAGE_BLOCK_IDS)("%s survives the sanitizer with the same structure", (id) => {
        const block = heroBlocks.find((b) => b.id === id);
        expect(block).toBeDefined();
        expect(normalize(sanitize(block!.content))).toBe(normalize(block!.content));
    });

    it.each(HERO_IMAGE_BLOCK_IDS)("%s keeps the image alt text and an own-asset src", (id) => {
        const block = heroBlocks.find((b) => b.id === id)!;
        const images = imageTags(sanitize(block.content));
        expect(images.length).toBeGreaterThan(0);
        for (const tag of images) {
            const src = /\ssrc="([^"]*)"/.exec(tag)?.[1] ?? "";
            const alt = /\salt="([^"]*)"/.exec(tag)?.[1] ?? "";
            expect(alt.trim().length).toBeGreaterThan(0);
            expect(classifyImageSource(src)).toBe("own");
        }
    });

    it("the background hero keeps its overlay and focal classes", () => {
        const block = heroBlocks.find((b) => b.id === "hero_image_background")!;
        const html = sanitize(block.content);
        expect(html).toContain('class="la-overlay la-overlay-40"');
        expect(html).toContain("la-focus-center");
    });

    it("hero blocks use classes only, never inline style or url()", () => {
        for (const block of heroBlocks) {
            expect(block.content).not.toMatch(/\sstyle\s*=/i);
            expect(block.content).not.toMatch(/url\(/i);
        }
    });

    it("the base CSS defines every overlay and focal class", () => {
        for (const cls of ["la-overlay-20", "la-overlay-40", "la-overlay-60", "la-focus-top", "la-focus-center", "la-focus-bottom"]) {
            expect(API_LANDING_PAGE_BASE_CSS).toContain(`.${cls} {`);
        }
    });

    it("the web copy of the base CSS matches the API copy the sanitizer ships with", () => {
        expect(LANDING_PAGE_BASE_CSS).toBe(API_LANDING_PAGE_BASE_CSS);
    });
});
