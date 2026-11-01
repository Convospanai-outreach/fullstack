import { describe, expect, it } from "vitest";
import themeCases from "../fixtures/landing-theme-cases.json";
import {
    THEME_PRESETS,
    accessibleTint,
    brandThemeFrom,
    contrastRatio,
    landingThemeSchema,
    parseLandingTheme,
    textOn,
    themeTokens,
    themeWrapper,
} from "@/modules/landing-agent/theme";

// Colours that cover dark, light and mid-luminance brands, plus the defaults.
const FIXED_COLOURS = ["#000000", "#0f172a", "#1e3a8a", "#0891b2", "#777777", "#fde047", "#ffffff", "#f8fafc"];

// A deterministic grid of brand colours (every 0x33 step in each channel: 6^3 = 216 colours).
function gridColours(): string[] {
    const out: string[] = [];
    for (let r = 0; r <= 255; r += 51) {
        for (let g = 0; g <= 255; g += 51) {
            for (let b = 0; b <= 255; b += 51) {
                out.push(`#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`);
            }
        }
    }
    return [...FIXED_COLOURS, ...out];
}

describe("contrast helper", () => {
    it("gives the WCAG reference values", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
        expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
        expect(contrastRatio("#ffffff", "#777777")).toBeCloseTo(contrastRatio("#777777", "#ffffff"), 6);
    });

    it("textOn always reaches AA (4.5:1) on dark, light and mid colours", () => {
        for (const bg of gridColours()) {
            expect(contrastRatio(textOn(bg), bg), `text on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("textOn keeps the page ink on light backgrounds and uses black or white on mid colours", () => {
        expect(textOn("#f8fafc")).toBe("#0f172a");
        expect(textOn("#777777")).toBe("#000000");
        expect(textOn("#0f172a")).toBe("#ffffff");
    });

    it("accessibleTint darkens a brand colour used as text until it reaches AA", () => {
        for (const surface of ["#ffffff", "#f8fafc", "#eef6fb"]) {
            for (const colour of gridColours()) {
                const tinted = accessibleTint(colour, surface);
                expect(contrastRatio(tinted, surface), `${colour} on ${surface}`).toBeGreaterThanOrEqual(4.5);
            }
        }
        expect(accessibleTint("#0e7490", "#ffffff")).toBe("#0e7490");
    });
});

describe("theme schema", () => {
    it("accepts a minimal and a full theme", () => {
        expect(landingThemeSchema.safeParse({ primary: "#0891b2", accent: "#22c55e" }).success).toBe(true);
        expect(
            landingThemeSchema.safeParse({ preset: "glass", primary: "#112233", accent: "#ABCDEF", font: "serif" }).success
        ).toBe(true);
    });

    it("rejects unknown keys, presets, fonts and non-#RRGGBB colours", () => {
        const base = { primary: "#0891b2", accent: "#22c55e" };
        const bad: unknown[] = [
            { ...base, extra: true },
            { ...base, preset: "neon" },
            { ...base, font: "Comic Sans MS" },
            { ...base, primary: "#fff" },
            { ...base, primary: "red" },
            { ...base, accent: "#22c55e; background:url(https://x.test/a.png)" },
            { ...base, accent: "rgb(1, 2, 3)" },
            { primary: "#0891b2" },
            { ...base, css: "body{}" },
            "not an object",
        ];
        for (const value of bad) {
            expect(landingThemeSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
            expect(parseLandingTheme(value), JSON.stringify(value)).toBeNull();
        }
    });

    it("parseLandingTheme returns null for an absent theme", () => {
        expect(parseLandingTheme(undefined)).toBeNull();
        expect(parseLandingTheme(null)).toBeNull();
    });

    it("lists exactly the four presets", () => {
        expect([...THEME_PRESETS]).toEqual(["clean", "glass", "bold", "minimal"]);
    });
});

describe("preset tokens meet AA for any brand colour", () => {
    for (const preset of THEME_PRESETS) {
        it(`${preset}: text, on-primary and primary-text pass 4.5:1`, () => {
            for (const colour of gridColours()) {
                const tokens = themeTokens({ preset, primary: colour, accent: colour });
                expect(contrastRatio(tokens["--la-text"], tokens["--la-bg"]), `text on bg, ${colour}`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(tokens["--la-text"], "#ffffff"), `text on surface, ${colour}`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(tokens["--la-on-primary"], colour), `on primary, ${colour}`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(tokens["--la-on-accent"], colour), `on accent, ${colour}`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(tokens["--la-primary-text"], tokens["--la-bg"]), `primary text on bg, ${colour}`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(tokens["--la-primary-text"], "#ffffff"), `primary text on surface, ${colour}`).toBeGreaterThanOrEqual(4.5);
            }
        });
    }
});

describe("themeWrapper (shared fixture for React and buildFullDocument)", () => {
    it("un-themed pages get the plain wrapper, no class modifier and no style", () => {
        expect(themeWrapper(null)).toEqual({ className: "la-page", vars: {} });
    });

    for (const fixture of themeCases.cases) {
        it(`case: ${fixture.name}`, () => {
            const wrapper = themeWrapper(parseLandingTheme(fixture.theme));
            expect(wrapper.className).toBe(fixture.className);
            for (const [key, value] of Object.entries(fixture.vars)) {
                expect(wrapper.vars[key], key).toBe(value);
            }
        });
    }
});

describe("brand seeding", () => {
    it("takes primaryColor and accentColor when they are #RRGGBB", () => {
        expect(brandThemeFrom({ primaryColor: "#112233", accentColor: "#ABCDEF" })).toEqual({ primary: "#112233", accent: "#ABCDEF" });
    });

    it("fills the missing or invalid one with today's default colour", () => {
        expect(brandThemeFrom({ primaryColor: "#112233" })).toEqual({ primary: "#112233", accent: "#22c55e" });
        expect(brandThemeFrom({ primaryColor: "#fff", accentColor: "#abcdef" })).toEqual({ primary: "#0891b2", accent: "#abcdef" });
    });

    it("returns null when neither colour is a valid #RRGGBB, so the page keeps today's look", () => {
        expect(brandThemeFrom({ primaryColor: "#fff", accentColor: "rgb(1,2,3)" })).toBeNull();
        expect(brandThemeFrom(null)).toBeNull();
        expect(brandThemeFrom("#112233")).toBeNull();
    });
});
