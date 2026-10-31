import { describe, expect, it } from "vitest";

import {
    classifyImageSource,
    imageAltWarnings,
    landingImagesPrefix,
} from "@/components/landing-agent/imageSources";

const PREFIX = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/landing-images/";

describe("classifyImageSource", () => {
    it("allows https URLs as external", () => {
        expect(classifyImageSource("https://images.example.com/hero.jpg")).toBe("external");
    });

    it("classifies our landing-images bucket as own when the prefix is given", () => {
        const url = `${PREFIX}team-a/0b6c2d9e-1f0a-4c3b-9d8e-7a6b5c4d3e2f.png`;
        expect(classifyImageSource(url, PREFIX)).toBe("own");
    });

    it("treats another bucket on the same Supabase project as external", () => {
        const url = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/content-media/x.jpg";
        expect(classifyImageSource(url, PREFIX)).toBe("external");
    });

    it("does not treat a landing-images look-alike with traversal as own", () => {
        const url = `${PREFIX}../content-media/x.jpg`;
        expect(classifyImageSource(url, PREFIX)).toBe("external");
    });

    it("treats the landing-images URL as external when no prefix is configured", () => {
        expect(classifyImageSource(`${PREFIX}team-a/x.png`, null)).toBe("external");
    });

    it("accepts our built-in /landing-assets/ files as own", () => {
        expect(classifyImageSource("/landing-assets/gradient-1.svg")).toBe("own");
    });

    it("rejects traversal out of /landing-assets/", () => {
        expect(classifyImageSource("/landing-assets/../secret.png")).toBe("rejected");
    });

    it("rejects other relative paths", () => {
        expect(classifyImageSource("/admin/logo.png")).toBe("rejected");
        expect(classifyImageSource("hero.png")).toBe("rejected");
    });

    it.each([
        ["http", "http://images.example.com/hero.jpg"],
        ["data", "data:image/png;base64,iVBORw0KGgo="],
        ["javascript", "javascript:alert(1)"],
        ["blob", "blob:https://example.com/3f2c"],
        ["protocol-relative", "//images.example.com/hero.jpg"],
        ["credentials", "https://user:pass@images.example.com/hero.jpg"],
        ["username only", "https://user@images.example.com/hero.jpg"],
        ["backslash", "https:\\\\images.example.com\\hero.jpg"],
        ["empty", "   "],
        ["not a URL", "https://"],
    ])("rejects %s", (_name, url) => {
        expect(classifyImageSource(url, PREFIX)).toBe("rejected");
    });
});

describe("landingImagesPrefix", () => {
    it("builds the public landing-images prefix from the Supabase project URL", () => {
        expect(landingImagesPrefix("https://abcdefghijklmnopqrst.supabase.co/")).toBe(PREFIX);
    });

    it("returns null when the project URL is missing or invalid", () => {
        expect(landingImagesPrefix(undefined)).toBeNull();
        expect(landingImagesPrefix("not a url")).toBeNull();
    });
});

describe("imageAltWarnings", () => {
    it("returns nothing when every image has alt text", () => {
        expect(imageAltWarnings('<img src="https://a.example/x.png" alt="Team at work">')).toEqual([]);
    });

    it("flags an image with no alt attribute", () => {
        expect(imageAltWarnings('<img src="https://a.example/x.png">')).toEqual([
            { src: "https://a.example/x.png", problem: "missing" },
        ]);
    });

    it("flags empty and whitespace-only alt text", () => {
        const html = '<img src="/landing-assets/a.svg" alt=""><img src="/landing-assets/b.svg" alt="   ">';
        expect(imageAltWarnings(html)).toEqual([
            { src: "/landing-assets/a.svg", problem: "empty" },
            { src: "/landing-assets/b.svg", problem: "empty" },
        ]);
    });

    it("handles single quotes and attribute order", () => {
        expect(imageAltWarnings("<img alt='Hero' src='/landing-assets/a.svg'>")).toEqual([]);
    });
});
