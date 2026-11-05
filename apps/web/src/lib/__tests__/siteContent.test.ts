import { describe, expect, it } from "vitest";
import { buildDecapConfig } from "../decapCms";
import { cleanNavGroups, mergeHeroText, mergeText, type HeroText } from "../siteContent";
import { HOME, HOME_DEFAULTS } from "../../components/marketing/v8/homeV8Content";
import navigation from "../../../content/settings/navigation.json";
import hero from "../../../content/settings/hero.json";
import homeJson from "../../../content/settings/home.json";

const DEFAULTS: HeroText = {
    topLine: "TOP",
    startButton: "Start",
    finalButton: "End",
    stages: Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, title: `T${i}`, accent: `A${i}`, detail: `D${i}` })),
};

describe("cleanNavGroups", () => {
    it("keeps the menus the site ships with", () => {
        const groups = cleanNavGroups(navigation);
        expect(groups.map((g) => g.label)).toEqual(["Product", "Use Cases", "Platform", "Resources"]);
        expect(groups[0]!.items[0]).toEqual({ label: "Fluid Funnel Engine", href: "/products/fluid-funnel-engine", badge: "New" });
        expect(groups.flatMap((g) => g.items).length).toBe(24);
    });

    it("drops links with an unsafe or missing address, and menus left empty", () => {
        const groups = cleanNavGroups({
            groups: [
                { label: "Ok", items: [
                    { label: "Fine", href: "/pricing" },
                    { label: "Outside", href: "https://example.com/x" },
                    { label: "Script", href: "javascript:alert(1)" },
                    { label: "Other host", href: "//evil.example" },
                    { label: "Plain http", href: "http://example.com" },
                    { label: "", href: "/blank" },
                    { label: "No address" },
                ] },
                { label: "Empty", items: [] },
                { label: "", items: [{ label: "x", href: "/x" }] },
            ],
        });
        expect(groups).toEqual([{ label: "Ok", items: [{ label: "Fine", href: "/pricing" }, { label: "Outside", href: "https://example.com/x" }] }]);
    });

    it("returns no menus for a missing or broken file instead of throwing", () => {
        expect(cleanNavGroups(null)).toEqual([]);
        expect(cleanNavGroups({ groups: "nope" })).toEqual([]);
    });
});

describe("mergeHeroText", () => {
    it("uses the editor's words", () => {
        const merged = mergeHeroText({ topLine: "New line", stages: [{ title: "Hello" }] }, DEFAULTS);
        expect(merged.topLine).toBe("New line");
        expect(merged.stages[0]!.title).toBe("Hello");
    });

    it("falls back to the built-in words for blanks and missing steps, and always keeps six steps", () => {
        const merged = mergeHeroText({ topLine: "  ", startButton: 5, stages: [{ title: "" }] }, DEFAULTS);
        expect(merged.topLine).toBe("TOP");
        expect(merged.startButton).toBe("Start");
        expect(merged.stages).toHaveLength(6);
        expect(merged.stages[0]).toEqual(DEFAULTS.stages[0]);
        expect(mergeHeroText(undefined, DEFAULTS)).toEqual(DEFAULTS);
    });

    it("ignores extra steps an editor might add", () => {
        const extra = { stages: Array.from({ length: 9 }, () => ({ title: "X" })) };
        expect(mergeHeroText(extra, DEFAULTS).stages).toHaveLength(6);
    });

    it("the shipped hero file has the six steps", () => {
        expect(hero.stages).toHaveLength(6);
    });
});

describe("mergeText", () => {
    const defaults = { a: "A", list: [{ t: "T0" }, { t: "T1" }], nested: { b: "B" } };

    it("uses the editor's words", () => {
        const merged = mergeText(defaults, { a: "New", list: [{ t: "X" }], nested: { b: "Y" } });
        expect(merged.a).toBe("New");
        expect(merged.list[0]!.t).toBe("X");
        expect(merged.nested.b).toBe("Y");
    });

    it("falls back for blanks, wrong types and missing entries, and keeps list length and keys", () => {
        const merged = mergeText(defaults, { a: "  ", list: [{ t: 5 }], nested: "nope", extra: "ignored" });
        expect(merged).toEqual(defaults);
        expect(mergeText(defaults, undefined)).toEqual(defaults);
        expect(mergeText(defaults, { list: Array.from({ length: 9 }, () => ({ t: "X" })) }).list).toHaveLength(2);
    });
});

describe("home page content", () => {
    it("the shipped home.json matches the built-in words", () => {
        expect(homeJson).toEqual(HOME_DEFAULTS);
        expect(HOME.story).toHaveLength(7);
        expect(HOME.workflow.steps).toHaveLength(6);
    });
});

describe("CMS config for menus and home page", () => {
    const config = buildDecapConfig("https://example.com");
    it("lets editors change the menus and the home page, and keeps fixed-length lists fixed", () => {
        expect(config).toContain("file: apps/web/content/settings/navigation.json");
        expect(config).toContain("file: apps/web/content/settings/home.json");
        expect(config).toMatch(/name: story\s+widget: list\s+allow_add: false\s+min: 7\s+max: 7/);
        expect(config).toMatch(/name: steps\s+widget: list\s+allow_add: false\s+min: 6\s+max: 6/);
    });
});
