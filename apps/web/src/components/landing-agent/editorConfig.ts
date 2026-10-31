import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";

// Pure editor settings shared by GrapesEditor and its tests. Nothing here imports
// GrapesJS, so the rules can be checked without a DOM.

export const AUTOSAVE_INTERVAL_MS = 10_000;

// Colours from the published landing CSS. The editor offers these first.
export const EDITOR_BRAND_COLORS = [
    "#0f172a",
    "#334155",
    "#475569",
    "#0e7490",
    "#0891b2",
    "#67e8f9",
    "#ecfeff",
    "#fffbeb",
    "#fcd34d",
    "#f8fafc",
    "#ffffff",
] as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Option = { value: string; label: string };

export type EditorStyleProperty =
    | { property: "color" | "background-color"; kind: "color"; label: string }
    | { property: "font-size" | "text-align" | "padding" | "border-radius"; kind: "select"; label: string; options: readonly Option[] };

// The only CSS the style panel can write. Colours are hex values; everything else
// is a fixed list, so no url(), no free text and no other property reaches the page.
export const EDITOR_STYLE_PROPERTIES: readonly EditorStyleProperty[] = [
    { property: "color", kind: "color", label: "Text colour" },
    { property: "background-color", kind: "color", label: "Background or button colour" },
    {
        property: "font-size",
        kind: "select",
        label: "Text size",
        options: ["14px", "16px", "18px", "20px", "24px", "32px", "40px", "48px"].map((v) => ({ value: v, label: v })),
    },
    {
        property: "text-align",
        kind: "select",
        label: "Alignment",
        options: [
            { value: "left", label: "Left" },
            { value: "center", label: "Centre" },
            { value: "right", label: "Right" },
        ],
    },
    {
        property: "padding",
        kind: "select",
        label: "Padding",
        options: ["0", "8px", "16px", "24px", "32px"].map((v) => ({ value: v, label: v })),
    },
    {
        property: "border-radius",
        kind: "select",
        label: "Corner radius",
        options: [
            { value: "0", label: "Square" },
            { value: "4px", label: "Soft" },
            { value: "8px", label: "Rounded" },
            { value: "16px", label: "Very rounded" },
            { value: "999px", label: "Pill" },
        ],
    },
];

// Drops every style value the style panel is not allowed to write.
export function filterEditorStyle(style: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const prop of EDITOR_STYLE_PROPERTIES) {
        const value = style[prop.property];
        if (typeof value !== "string") continue;
        const allowed = prop.kind === "color" ? HEX_COLOR.test(value) : prop.options.some((o) => o.value === value);
        if (allowed) out[prop.property] = value;
    }
    return out;
}

// Links the editor may set: https, mailto, tel and in-page anchors. An empty value
// clears the link. Everything else (javascript:, data:, http:, relative paths) is refused.
const SAFE_EDITOR_LINK_PATTERNS = [
    /^https:\/\/\S+$/i,
    /^mailto:\S+$/i,
    /^tel:[+\d][\d\s().-]{2,30}$/i,
    /^#[A-Za-z][\w-]{0,63}$/,
];

export function isSafeEditorLink(value: string): boolean {
    const href = value.trim();
    if (!href) return true;
    return SAFE_EDITOR_LINK_PATTERNS.some((pattern) => pattern.test(href));
}

// The link trait's setter: writes href only when the value passes isSafeEditorLink.
export function applyEditorLinkHref(component: { addAttributes: (attrs: Record<string, string>) => unknown }, value: unknown): boolean {
    if (typeof value !== "string" || !isSafeEditorLink(value)) return false;
    component.addAttributes({ href: value.trim() });
    return true;
}

// Traits the editor exposes on a link or text component. There is no raw CSS,
// class, id or code trait.
export const EDITOR_TRAIT_NAMES = ["title", "href", "target"] as const;

// The canvas gets the same stylesheet the published page starts from. It is added as an inline
// <style> in the canvas frame: the dashboard's CSP allows inline styles but not data: stylesheets.
export function canvasBaseCss(): string {
    return LANDING_PAGE_BASE_CSS;
}

// Saved CSS is withLandingBaseCss(userRules). This strips the base part again so
// the style manager only holds the user's own rules.
export function userCssFromSaved(savedCss: string): string {
    const base = LANDING_PAGE_BASE_CSS.trim();
    const trimmed = savedCss.trim();
    return trimmed.startsWith(base) ? trimmed.slice(base.length).trim() : trimmed;
}

export function shouldAutosave(state: { status: string; dirty: boolean; saving: boolean }): boolean {
    return state.status !== "published" && state.dirty && !state.saving;
}

export const EDITOR_DEVICES = [
    { name: "Desktop", width: "" },
    { name: "Tablet", width: "768px", widthMedia: "992px" },
    { name: "Mobile", width: "390px", widthMedia: "480px" },
] as const;

// Starter blocks. Classes and elements match the published CSS and survive the
// sanitizer: sections are la-section, calls to action are anchors with la-cta.
// cta_form is still the old block (it contains a form the sanitizer removes); it is
// replaced by the lead form block in phase 1.
export const EDITOR_BLOCKS: readonly { id: string; label: string; content: string }[] = [
    {
        id: "hero",
        label: "Hero",
        content: `
<section class="la-section la-hero">
    <p class="la-eyebrow">Your offer</p>
    <h1>Primary headline</h1>
    <p>Core value proposition for your audience.</p>
    <a class="la-cta" href="#lead-form">Book a demo</a>
</section>`,
    },
    {
        id: "challenge_solution",
        label: "Challenge/Solution",
        content: `
<section class="la-section">
    <h2>Challenge</h2>
    <p>Describe buyer pain clearly.</p>
    <h3>Solution</h3>
    <p>Explain why your approach is practical.</p>
</section>`,
    },
    {
        id: "benefits",
        label: "Benefits",
        content: `
<section class="la-section">
    <h2>Benefits</h2>
    <ul>
        <li>Benefit one</li>
        <li>Benefit two</li>
        <li>Benefit three</li>
    </ul>
</section>`,
    },
    {
        id: "hero_image_background",
        label: "Hero with background image",
        content: `
<section class="la-section la-hero la-hero-bg">
    <img class="la-hero-bg-img la-focus-center" src="/landing-assets/gradient-1.svg" alt="Abstract header background" loading="lazy" />
    <div class="la-overlay la-overlay-40"></div>
    <div class="la-hero-bg-content">
        <p class="la-eyebrow">Your offer</p>
        <h1>Primary headline</h1>
        <p>Core value proposition for your audience.</p>
        <a class="la-cta" href="#lead-form">Book a demo</a>
    </div>
</section>`,
    },
    {
        id: "hero_image_split",
        label: "Hero with side image",
        content: `
<section class="la-section la-hero la-hero-with-image">
    <div class="la-hero-copy">
        <p class="la-eyebrow">Your offer</p>
        <h1>Primary headline</h1>
        <p>Core value proposition for your audience.</p>
        <a class="la-cta" href="#lead-form">Book a demo</a>
    </div>
    <div class="la-hero-media">
        <img src="/landing-assets/gradient-2.svg" alt="Abstract header image" loading="lazy" />
    </div>
</section>`,
    },
    {
        id: "hero_image_top",
        label: "Hero with image above headline",
        content: `
<section class="la-section la-hero la-hero-top">
    <div class="la-hero-media">
        <img src="/landing-assets/gradient-3.svg" alt="Abstract header image" loading="lazy" />
    </div>
    <p class="la-eyebrow">Your offer</p>
    <h1>Primary headline</h1>
    <p>Core value proposition for your audience.</p>
    <a class="la-cta" href="#lead-form">Book a demo</a>
</section>`,
    },
    {
        id: "cta_form",
        label: "CTA Form",
        content: `
<section class="landing-section cta">
    <h2>Talk to our team</h2>
    <p>We will reach out within one business day.</p>
    <form>
        <input type="text" placeholder="Name" />
        <input type="email" placeholder="Work Email" />
        <button type="submit">Submit</button>
    </form>
</section>`,
    },
];
