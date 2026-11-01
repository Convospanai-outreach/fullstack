// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishedLandingRenderer from "./PublishedLandingRenderer";

// The same fixture the api side reads for the Worker document (apps/api theme.test.ts).
const themeCases = JSON.parse(
    readFileSync(resolve(__dirname, "../../../tests/fixtures/landing-theme-cases.json"), "utf8")
) as { cases: { name: string; theme: unknown; className: string; vars: Record<string, string> }[] };

describe("PublishedLandingRenderer page theme", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    function render(renderedJson: unknown) {
        act(() => {
            root.render(<PublishedLandingRenderer slug="spring" title="Spring" version={1} renderedJson={renderedJson} />);
        });
        return container.querySelector<HTMLElement>(".la-page");
    }

    it("un-themed pages keep today's wrapper classes and get no inline variables", () => {
        const wrapper = render({ html: "<p>Hello</p>", css: "" });
        expect(wrapper?.className).toContain("bg-slate-100");
        expect(wrapper?.style.length).toBe(0);
    });

    for (const fixture of themeCases.cases) {
        it(`case: ${fixture.name}`, () => {
            const wrapper = render({ html: "<p>Hello</p>", css: "", theme: fixture.theme });
            expect(wrapper).not.toBeNull();
            // Themed pages drop the Tailwind background/text utilities, so the theme decides both colours.
            expect(wrapper?.className.split(" ").filter((c) => c)).toEqual(fixture.className.split(" ").concat("min-h-screen"));
            for (const [key, value] of Object.entries(fixture.vars)) {
                expect(wrapper?.style.getPropertyValue(key), key).toBe(value);
            }
        });
    }

    it("an invalid theme renders as un-themed", () => {
        const wrapper = render({ html: "<p>Hello</p>", css: "", theme: { preset: "neon", primary: "#112233", accent: "#abcdef" } });
        expect(wrapper?.className).toContain("bg-slate-100");
        expect(wrapper?.style.length).toBe(0);
    });
});
