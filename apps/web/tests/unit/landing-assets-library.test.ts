import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LANDING_ASSET_LIBRARY } from "@/components/landing-agent/landingAssetLibrary";

const ASSET_DIR = fileURLToPath(new URL("../../public/landing-assets", import.meta.url));
const svgFiles = readdirSync(ASSET_DIR).filter((name) => name.endsWith(".svg"));
const MAX_BYTES = 15 * 1024;

describe("built-in landing header library", () => {
    it("lists exactly eight headers with unique ids and non-empty alt text", () => {
        expect(LANDING_ASSET_LIBRARY).toHaveLength(8);
        expect(new Set(LANDING_ASSET_LIBRARY.map((asset) => asset.id)).size).toBe(8);
        for (const asset of LANDING_ASSET_LIBRARY) {
            expect(asset.label.trim()).not.toBe("");
            expect(asset.alt.trim()).not.toBe("");
            expect(asset.path).toMatch(/^\/landing-assets\/[a-z0-9-]+\.svg$/);
        }
    });

    it("every listed path is a file in the folder, and the folder has no other SVGs", () => {
        const listed = LANDING_ASSET_LIBRARY.map((asset) => asset.path.split("/").pop());
        expect([...listed].sort()).toEqual([...svgFiles].sort());
    });
});

describe.each(svgFiles)("%s", (name) => {
    const text = readFileSync(`${ASSET_DIR}/${name}`, "utf8");

    it("is a small SVG under 15 KB", () => {
        expect(statSync(`${ASSET_DIR}/${name}`).size).toBeLessThan(MAX_BYTES);
        expect(text.trimStart().startsWith("<svg")).toBe(true);
    });

    it("has no script, no event handlers and no hyperlinks", () => {
        expect(text).not.toMatch(/<script/i);
        expect(text).not.toMatch(/\son[a-z]+\s*=/i);
        expect(text).not.toMatch(/\bhref\s*=/i);
        expect(text).not.toMatch(/xlink:href/i);
        expect(text).not.toMatch(/<foreignObject/i);
    });

    it("references no external URL (the SVG namespace is the only URL)", () => {
        const urls = text.match(/https?:\/\/[^"'\s)]+/g) ?? [];
        expect(urls.every((url) => url === "http://www.w3.org/2000/svg")).toBe(true);
    });
});
