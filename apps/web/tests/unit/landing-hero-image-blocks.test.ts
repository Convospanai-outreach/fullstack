import { describe, expect, it } from "vitest";

import { EDITOR_BLOCKS } from "@/components/landing-agent/editorConfig";
import { buildHeroImageHtml } from "@/components/landing-agent/heroImageBlock";
import { classifyImageSource } from "@/components/landing-agent/imageSources";
import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";
import fixture from "../fixtures/hero-image-markup.json";

const HERO_IMAGE_BLOCK_IDS = ["hero_image_background", "hero_image_split", "hero_image_top"];
const heroBlocks = EDITOR_BLOCKS.filter((block) => HERO_IMAGE_BLOCK_IDS.includes(block.id));

function imageTags(html: string): string[] {
    return html.match(/<img[^>]*>/gi) ?? [];
}

describe("hero image blocks", () => {
    it("ships the three hero image layouts", () => {
        expect(heroBlocks.map((block) => block.id).sort()).toEqual([...HERO_IMAGE_BLOCK_IDS].sort());
    });

    // apps/api/src/modules/landing-agent/heroImageMarkup.test.ts runs this same fixture through the
    // real sanitizer. If a block or the builder output changes, regenerate
    // tests/fixtures/hero-image-markup.json so that test keeps checking the current markup.
    it.each(HERO_IMAGE_BLOCK_IDS)("%s matches the markup fixture the sanitizer test uses", (id) => {
        const block = heroBlocks.find((b) => b.id === id);
        expect(block).toBeDefined();
        expect((fixture.blocks as Record<string, string>)[id]).toBe(block!.content);
    });

    it.each(["background", "side", "top"] as const)("the %s builder output matches the markup fixture", (layout) => {
        const html = buildHeroImageHtml({ layout, src: "/landing-assets/gradient-1.svg", alt: "Blue wave", focal: "center", darken: 40 });
        expect(html).toBe(fixture.built[layout]);
    });

    it.each(HERO_IMAGE_BLOCK_IDS)("%s has an image with alt text and an own-asset src", (id) => {
        const block = heroBlocks.find((b) => b.id === id)!;
        const images = imageTags(block.content);
        expect(images.length).toBeGreaterThan(0);
        for (const tag of images) {
            const src = /\ssrc="([^"]*)"/.exec(tag)?.[1] ?? "";
            const alt = /\salt="([^"]*)"/.exec(tag)?.[1] ?? "";
            expect(alt.trim().length).toBeGreaterThan(0);
            expect(classifyImageSource(src)).toBe("own");
        }
    });

    it("the background hero has its overlay and focal classes", () => {
        const block = heroBlocks.find((b) => b.id === "hero_image_background")!;
        expect(block.content).toContain('class="la-overlay la-overlay-40"');
        expect(block.content).toContain("la-focus-center");
    });

    it("hero blocks use classes only, never inline style or url()", () => {
        for (const block of heroBlocks) {
            expect(block.content).not.toMatch(/\sstyle\s*=/i);
            expect(block.content).not.toMatch(/url\(/i);
        }
    });

    it("the base CSS defines every overlay and focal class", () => {
        for (const cls of ["la-overlay-20", "la-overlay-40", "la-overlay-60", "la-focus-top", "la-focus-center", "la-focus-bottom"]) {
            expect(LANDING_PAGE_BASE_CSS).toContain(`.${cls} {`);
        }
    });
});
