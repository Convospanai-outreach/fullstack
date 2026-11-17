// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PageThemePanel from "./PageThemePanel";
import type { LandingTheme } from "@/modules/landing-agent/theme";

describe("PageThemePanel", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    function mount(theme: LandingTheme | null, onChange = vi.fn()) {
        act(() => {
            root.render(<PageThemePanel theme={theme} onChange={onChange} />);
        });
        return { onChange };
    }

    function button(label: string): HTMLButtonElement {
        const found = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
        if (!found) throw new Error(`no button "${label}"`);
        return found;
    }

    function click(el: HTMLElement) {
        act(() => {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
    }

    function typeInto(el: HTMLInputElement | HTMLSelectElement, value: string) {
        act(() => {
            const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
            el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
        });
    }

    it("offers the four presets and the current look", () => {
        mount(null);
        for (const label of ["Current look", "Clean", "Glass", "Bold", "Minimal"]) {
            expect(button(label)).toBeTruthy();
        }
    });

    it("choosing a preset on an unthemed page starts from the default colours", () => {
        const { onChange } = mount(null);
        click(button("Bold"));
        expect(onChange).toHaveBeenCalledWith({ preset: "bold", primary: "#0891b2", accent: "#22c55e" });
    });

    it("choosing the current look keeps the colours and drops the preset", () => {
        const { onChange } = mount({ preset: "glass", primary: "#112233", accent: "#abcdef" });
        click(button("Current look"));
        const next = onChange.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(next).toEqual({ primary: "#112233", accent: "#abcdef" });
        expect(next).not.toHaveProperty("preset");
    });

    it("the colour inputs change the primary and accent colours", () => {
        const { onChange } = mount({ preset: "clean", primary: "#112233", accent: "#abcdef" });
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="color"]');
        expect(inputs).toHaveLength(2);
        typeInto(inputs[0] as HTMLInputElement, "#445566");
        expect(onChange).toHaveBeenLastCalledWith({ preset: "clean", primary: "#445566", accent: "#abcdef" });
        typeInto(inputs[1] as HTMLInputElement, "#778899");
        expect(onChange).toHaveBeenLastCalledWith({ preset: "clean", primary: "#112233", accent: "#778899" });
    });

    it("the font select only offers the safe list", () => {
        const { onChange } = mount({ preset: "clean", primary: "#112233", accent: "#abcdef" });
        const select = container.querySelector("select") as HTMLSelectElement;
        const options = Array.from(select.options).map((o) => o.value);
        expect(options).toEqual(["system", "serif", "humanist", "mono"]);
        typeInto(select, "serif");
        expect(onChange).toHaveBeenLastCalledWith({ preset: "clean", primary: "#112233", accent: "#abcdef", font: "serif" });
    });

    it("Use my brand colours copies the team's branding into the theme", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true, json: async () => ({ branding: { primaryColor: "#112233", accentColor: "#ABCDEF" } }) }))
        );
        const { onChange } = mount({ preset: "minimal", primary: "#000000", accent: "#000000" });
        click(button("Use my brand colours"));
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(fetch).toHaveBeenCalledWith("/api/settings/branding", expect.anything());
        expect(onChange).toHaveBeenLastCalledWith({ preset: "minimal", primary: "#112233", accent: "#ABCDEF" });
    });

    it("says so when the team has no valid brand colour, and leaves the theme alone", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ branding: { primaryColor: "#fff" } }) })));
        const { onChange } = mount({ preset: "minimal", primary: "#000000", accent: "#000000" });
        click(button("Use my brand colours"));
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(container.textContent).toMatch(/no brand colours/i);
    });

    it("removes the theme", () => {
        const { onChange } = mount({ preset: "bold", primary: "#112233", accent: "#abcdef" });
        click(button("Remove theme"));
        expect(onChange).toHaveBeenCalledWith(null);
    });
});
