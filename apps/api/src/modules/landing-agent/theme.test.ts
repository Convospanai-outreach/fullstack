import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { LANDING_PAGE_BASE_CSS } from "./rendering";
import { THEME_PRESETS, parseLandingTheme, themeWrapper } from "./theme";
import { buildFullDocument } from "./service/cloudflarePagesService";

// The web app owns the shared fixtures; this side reads them with fs (no import from apps/web).
const WEB = resolve(__dirname, "../../../../web");
const themeCases = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/landing-theme-cases.json"), "utf8")) as {
    cases: { name: string; theme: unknown; className: string; vars: Record<string, string> }[];
};
const baseline = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/landing-theme-baseline.json"), "utf8")) as {
    baseCss: string;
    sampleHtml: string;
    unthemedDocument: string;
};

const THEME_START = "/* theme:start */";
const THEME_END = "/* theme:end */";

// Removes the theme block and every var(--la-x, FALLBACK) wrapper: what is left must be today's CSS.
function withoutThemeAndVars(css: string): string {
    const start = css.indexOf(THEME_START);
    const end = css.indexOf(THEME_END);
    const stripped = start < 0 || end < 0 ? css : css.slice(0, start) + css.slice(end + THEME_END.length).replace(/^\n/, "");
    return stripped.replace(/var\(--la-[a-z-]+, ([^()]*?)\)/g, "$1");
}

function bodyAttributes(doc: string): { className: string; vars: Record<string, string> } {
    const tag = /<body([^>]*)>/.exec(doc);
    if (!tag) throw new Error("no body tag");
    const className = /class="([^"]*)"/.exec(tag[1])?.[1] ?? "";
    // The attribute is HTML-escaped (font stacks contain double quotes), so decode it before comparing.
    const styleText = (/style="([^"]*)"/.exec(tag[1])?.[1] ?? "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    const vars: Record<string, string> = {};
    for (const decl of styleText.split(";").filter(Boolean)) {
        const [key, ...value] = decl.split(":");
        vars[key.trim()] = value.join(":").trim();
    }
    return { className, vars };
}

describe("theme CSS and document output", () => {
    it("un-themed pages: base CSS minus the theme block and var wrappers is today's CSS", () => {
        expect(withoutThemeAndVars(LANDING_PAGE_BASE_CSS)).toBe(baseline.baseCss);
    });

    it("un-themed pages: the Worker document is byte-identical to the pre-theme document", () => {
        const doc = buildFullDocument({
            title: "Spring Offer",
            css: baseline.baseCss,
            html: baseline.sampleHtml,
            script: "console.log(1);",
            whatsappOptIn: null,
            slug: "spring",
        });
        expect(doc).toBe(baseline.unthemedDocument);
    });

    it("each preset has its class-scoped rules in the base CSS", () => {
        for (const preset of THEME_PRESETS) {
            expect(LANDING_PAGE_BASE_CSS, preset).toContain(`.la-page.la-theme-${preset} `);
        }
    });

    it("glass falls back to solid without backdrop-filter and under prefers-contrast: more", () => {
        expect(LANDING_PAGE_BASE_CSS).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\)/);
        expect(LANDING_PAGE_BASE_CSS).toMatch(/@media \(prefers-contrast: more\)/);
    });

    it("motion is never required: reduced-motion removes transitions", () => {
        expect(LANDING_PAGE_BASE_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    });

    it("existing CTA classes take their colours from the theme variables with today's colours as fallback", () => {
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-primary, #0891b2)");
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-on-primary, #ffffff)");
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-primary-text, #0e7490)");
    });

    it("phase 3 blocks (pricing cards, FAQ rules) and the Instagram CTA use theme variables too", () => {
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-surface, #f8fafc)");
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-hairline, #e2e8f0)");
        expect(LANDING_PAGE_BASE_CSS).toContain("var(--la-accent, #0f172a)");
        expect(LANDING_PAGE_BASE_CSS).toContain("color: var(--la-on-accent);");
    });

    it("buildFullDocument puts the preset class and the variables on the body", () => {
        for (const fixture of themeCases.cases) {
            const doc = buildFullDocument({
                title: "T",
                css: baseline.baseCss,
                html: baseline.sampleHtml,
                script: "",
                whatsappOptIn: null,
                slug: "spring",
                theme: parseLandingTheme(fixture.theme),
            });
            const body = bodyAttributes(doc);
            expect(body.className, fixture.name).toBe(fixture.className);
            for (const [key, value] of Object.entries(fixture.vars)) {
                expect(body.vars[key], `${fixture.name} ${key}`).toBe(value);
            }
            // The body carries exactly the variables themeWrapper computes, nothing else.
            expect(body.vars).toEqual(themeWrapper(parseLandingTheme(fixture.theme)).vars);
        }
    });
});

describe("theme copies stay equal", () => {
    it("the api theme module is identical to the web one", () => {
        const web = readFileSync(resolve(WEB, "src/modules/landing-agent/theme.ts"), "utf8").replace(/\r\n/g, "\n");
        const api = readFileSync(resolve(__dirname, "theme.ts"), "utf8").replace(/\r\n/g, "\n");
        expect(api).toBe(web);
    });
});
