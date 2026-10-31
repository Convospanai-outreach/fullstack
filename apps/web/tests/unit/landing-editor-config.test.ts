import { describe, expect, it, vi } from "vitest";

import {
    AUTOSAVE_INTERVAL_MS,
    EDITOR_BLOCKS,
    EDITOR_DEVICES,
    EDITOR_STYLE_PROPERTIES,
    EDITOR_TRAIT_NAMES,
    applyEditorLinkHref,
    canvasBaseCss,
    filterEditorStyle,
    isSafeEditorLink,
    shouldAutosave,
    userCssFromSaved,
} from "@/components/landing-agent/editorConfig";
import { LANDING_PAGE_BASE_CSS, getLandingRenderPayload, withLandingBaseCss } from "@/modules/landing-agent/rendering";

describe("canvas CSS matches the published page CSS", () => {
    it("the canvas stylesheet is exactly the base CSS the published page uses", () => {
        expect(canvasBaseCss()).toBe(LANDING_PAGE_BASE_CSS);
    });

    it("published CSS with user rules starts with the canvas stylesheet", () => {
        const published = withLandingBaseCss("#i1{color:#0891b2;}");
        expect(published.startsWith(canvasBaseCss())).toBe(true);
    });

    it("a page saved by the editor renders the same CSS it was edited with", () => {
        const saved = withLandingBaseCss("#i1{color:#0891b2;}");
        const reloaded = userCssFromSaved(getLandingRenderPayload({ html: "<p>x</p>", css: saved }).css);
        expect(reloaded).toBe("#i1{color:#0891b2;}");
        expect(withLandingBaseCss(reloaded)).toBe(saved);
    });

    it("a page with no user rules reloads with no user CSS", () => {
        expect(userCssFromSaved(withLandingBaseCss(""))).toBe("");
    });
});

describe("link trait", () => {
    it.each([
        "https://example.com/offer",
        "HTTPS://example.com",
        "mailto:hello@example.com",
        "tel:+91 98765 43210",
        "#lead-form",
        "#section-2",
        "",
    ])("accepts %s", (value) => {
        expect(isSafeEditorLink(value)).toBe(true);
    });

    it.each([
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        " javascript:alert(1)",
        "java\tscript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD4=",
        "vbscript:msgbox(1)",
        "http://example.com",
        "/relative/path",
        "//evil.example.com",
        "#bad space",
        "https://",
        "tel:abc",
    ])("rejects %s", (value) => {
        expect(isSafeEditorLink(value)).toBe(false);
    });

    it("sets href on a call-to-action anchor when the value is safe", () => {
        const component = { attributes: { class: "la-cta" }, addAttributes: vi.fn() };
        expect(applyEditorLinkHref(component, "https://example.com/book")).toBe(true);
        expect(component.addAttributes).toHaveBeenCalledWith({ href: "https://example.com/book" });
    });

    it("never sets a javascript: href through the trait", () => {
        const component = { attributes: { class: "la-cta" }, addAttributes: vi.fn() };
        expect(applyEditorLinkHref(component, "javascript:alert(1)")).toBe(false);
        expect(component.addAttributes).not.toHaveBeenCalled();
    });

    it("rejects non-string trait values", () => {
        const component = { attributes: {}, addAttributes: vi.fn() };
        expect(applyEditorLinkHref(component, { href: "javascript:alert(1)" })).toBe(false);
        expect(component.addAttributes).not.toHaveBeenCalled();
    });
});

describe("no raw CSS or code field in the editor", () => {
    const forbidden = /^(css|code|script|html|content|custom|style|customcss|innerhtml)$/i;

    it("exposes only title, href and target as traits", () => {
        expect([...EDITOR_TRAIT_NAMES]).toEqual(["title", "href", "target"]);
    });

    it("style properties are the restricted set and none is a free-form field", () => {
        const names = EDITOR_STYLE_PROPERTIES.map((p) => p.property);
        expect(names.sort()).toEqual(["background-color", "border-radius", "color", "font-size", "padding", "text-align"]);
        for (const name of [...names, ...EDITOR_TRAIT_NAMES]) {
            expect(forbidden.test(name)).toBe(false);
        }
    });

    it("every style property with a value list has at least one allowed value", () => {
        for (const prop of EDITOR_STYLE_PROPERTIES) {
            if (prop.kind === "select") expect(prop.options.length).toBeGreaterThan(0);
        }
    });
});

describe("style filter", () => {
    it("keeps allowed colour, size and alignment values", () => {
        expect(filterEditorStyle({ color: "#0f172a", "font-size": "24px", "text-align": "center" })).toEqual({
            color: "#0f172a",
            "font-size": "24px",
            "text-align": "center",
        });
    });

    it("drops url(), unknown properties and values outside the palette", () => {
        const cleaned = filterEditorStyle({
            "background-image": "url(https://evil.example/x.png)",
            position: "fixed",
            color: "red;background:url(x)",
            "font-size": "999px",
            "text-align": "justify",
            padding: "16px",
        });
        expect(cleaned).toEqual({ padding: "16px" });
    });

    it("rejects a colour that is not a hex value", () => {
        expect(filterEditorStyle({ "background-color": "rgb(1,2,3)" })).toEqual({});
        expect(filterEditorStyle({ "background-color": "#0891b2" })).toEqual({ "background-color": "#0891b2" });
    });
});

describe("autosave", () => {
    it("runs every 10 seconds", () => {
        expect(AUTOSAVE_INTERVAL_MS).toBe(10_000);
    });

    it("saves draft pages with changes, not published ones", () => {
        expect(shouldAutosave({ status: "draft", dirty: true, saving: false })).toBe(true);
        expect(shouldAutosave({ status: "published", dirty: true, saving: false })).toBe(false);
        expect(shouldAutosave({ status: "draft", dirty: false, saving: false })).toBe(false);
        expect(shouldAutosave({ status: "draft", dirty: true, saving: true })).toBe(false);
    });
});

describe("devices", () => {
    it("offers desktop, tablet and mobile widths", () => {
        expect(EDITOR_DEVICES.map((d) => d.name)).toEqual(["Desktop", "Tablet", "Mobile"]);
        expect(EDITOR_DEVICES.find((d) => d.name === "Mobile")?.width).toBe("390px");
    });
});

// cta_form keeps its old markup until phase 1 replaces it with the lead form block.
const publishedBlocks = EDITOR_BLOCKS.filter((b) => b.id !== "cta_form");

describe("editor blocks", () => {
    it("use the published class names and an anchor button, not a button element", () => {
        for (const block of publishedBlocks) {
            expect(block.content).not.toMatch(/landing-section|<button|<form|<input|style=/);
        }
    });

    it.each(publishedBlocks.map((b) => [b.id, b] as const))(
        "%s survives the sanitizer round-trip with its structure",
        (_id, block) => {
            const rendered = getLandingRenderPayload({ html: block.content, css: "" }).html;
            expect(rendered).toMatch(/<section/);
            expect(rendered).toMatch(/class="la-section/);
        }
    );

    it("the hero call to action survives the sanitizer as a lead-form link", () => {
        const hero = EDITOR_BLOCKS.find((b) => b.id === "hero");
        const rendered = getLandingRenderPayload({ html: hero!.content, css: "" }).html;
        expect(rendered).toContain('<a class="la-cta" href="#lead-form">');
    });

    it("per-component styles survive the sanitizer round-trip", () => {
        const payload = getLandingRenderPayload({
            html: '<h1 id="i3kd">Hi</h1>',
            css: "#i3kd{color:#0891b2;font-size:24px;}",
        });
        expect(payload.html).toContain('id="i3kd"');
        expect(payload.css).toContain("#i3kd{color:#0891b2;font-size:24px;}");
    });
});
