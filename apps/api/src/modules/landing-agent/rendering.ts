import sanitizeHtml from "sanitize-html";

export interface LandingRenderPayload {
    html: string;
    css: string;
}

interface LandingPageSectionLike {
    id?: unknown;
    type?: unknown;
    heading?: unknown;
    body?: unknown;
    bullets?: unknown;
    ctaLabel?: unknown;
    ctaHref?: unknown;
    imageUrl?: unknown;
    imageAlt?: unknown;
}

export const LANDING_PAGE_BASE_CSS = `
.la-page {
    background: var(--la-bg, #f8fafc);
    color: var(--la-text, #0f172a);
    font-family: var(--la-font, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
.la-section {
    margin: 0 auto 24px;
    max-width: 960px;
    border: 1px solid var(--la-hairline, #dbe4ee);
    border-radius: 14px;
    background: var(--la-surface, #ffffff);
    padding: 28px;
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.08);
}
.la-hero {
    border-color: #67e8f9;
    background: linear-gradient(135deg, #ecfeff 0%, #ffffff 58%, #f8fafc 100%);
    padding: 44px 32px;
}
.la-eyebrow {
    margin: 0 0 10px;
    color: var(--la-primary-text, #0e7490);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}
.la-section h1,
.la-section h2,
.la-section h3 {
    margin: 0;
    color: var(--la-text, #0f172a);
    line-height: 1.08;
}
.la-section h1 {
    max-width: 820px;
    font-size: clamp(36px, 6vw, 64px);
}
.la-section h2 {
    font-size: 28px;
}
.la-section p {
    color: #475569;
    font-size: 16px;
    line-height: 1.7;
}
.la-section ul {
    margin: 18px 0 0;
    padding-left: 20px;
}
.la-section li {
    margin: 8px 0;
    color: #334155;
}
.la-cta {
    display: inline-flex;
    margin-top: 14px;
    border-radius: 8px;
    background: var(--la-primary, #0891b2);
    color: var(--la-on-primary, #ffffff);
    font-weight: 700;
    padding: 14px 20px;
    text-decoration: none;
}
.la-cta-outline {
    background: transparent;
    color: var(--la-primary-text, #0e7490);
    box-shadow: inset 0 0 0 2px var(--la-primary, #0891b2);
}
.la-cta-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}
.la-cta-micro {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
}
.la-cta-sticky {
    margin-top: 16px;
}
.la-hero-with-image {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: 32px;
}
.la-hero-media img {
    width: 100%;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 20px 44px rgba(15, 23, 42, 0.14);
}
@media (max-width: 720px) {
    .la-cta-mobile-full {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        justify-content: center;
        font-size: 18px;
        padding: 16px 20px;
    }
    .la-cta-sticky {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 50;
        margin: 0;
        padding: 10px 16px;
        background: var(--la-surface, #ffffff);
        box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.12);
    }
    .la-cta-sticky .la-cta {
        margin-top: 0;
    }
    .la-hero-with-image {
        grid-template-columns: 1fr;
    }
}
.la-section.la-divider {
    height: 1px;
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #cbd5e1;
}
.la-image-text {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 32px;
}
.la-image-text img {
    width: 100%;
    height: auto;
    border-radius: 12px;
}
.la-pricing {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 18px;
}
.la-plan {
    border: 1px solid var(--la-hairline, #dbe4ee);
    border-radius: 12px;
    padding: 20px;
    background: var(--la-surface, #f8fafc);
}
.la-faq-item {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--la-hairline, #e2e8f0);
}
.la-faq-item h3 {
    font-size: 18px;
}
.la-cta.la-instagram {
    background: var(--la-accent, #0f172a);
}
@media (max-width: 720px) {
    .la-image-text {
        grid-template-columns: 1fr;
    }
}
.la-proof img,
.la-testimonial img {
    width: 100%;
    max-width: 480px;
    height: auto;
    border-radius: 10px;
    margin: 12px 0;
}
.la-testimonial {
    border-color: #fcd34d;
    background: #fffbeb;
}
.la-footer {
    border-color: #cbd5e1;
    background: #0f172a;
}
.la-footer h2,
.la-footer p {
    color: #f8fafc;
}
.la-hero-bg {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    min-height: 360px;
    background: #0f172a;
}
.la-hero-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
}
.la-overlay {
    position: absolute;
    inset: 0;
    background: #0f172a;
    z-index: 1;
}
.la-overlay-20 {
    opacity: 0.2;
}
.la-overlay-40 {
    opacity: 0.4;
}
.la-overlay-60 {
    opacity: 0.6;
}
.la-hero-bg-content {
    position: relative;
    z-index: 2;
    max-width: 640px;
    padding: 48px 32px;
}
.la-hero-bg h1,
.la-hero-bg p {
    color: #ffffff;
}
.la-focus-top {
    object-position: center top;
}
.la-focus-center {
    object-position: center center;
}
.la-focus-bottom {
    object-position: center bottom;
}
.la-hero-top .la-hero-media img {
    max-height: 360px;
    object-fit: cover;
}
/* theme:start */
.la-page.la-theme-clean .la-section {
    border-color: transparent;
    border-radius: 16px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08), 0 24px 48px rgba(15, 23, 42, 0.06);
}
.la-page.la-theme-clean .la-hero {
    border-color: transparent;
    background: linear-gradient(135deg, var(--la-tint) 0%, var(--la-surface) 58%, var(--la-bg) 100%);
}
.la-page.la-theme-clean .la-cta {
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}
.la-page.la-theme-glass {
    background-color: var(--la-bg);
    background-image: var(--la-bg-image);
}
.la-page.la-theme-glass .la-section {
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.62);
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.12);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    backdrop-filter: blur(14px) saturate(140%);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .la-page.la-theme-glass .la-section {
        background: #ffffff;
    }
}
@media (prefers-contrast: more) {
    .la-page.la-theme-glass .la-section {
        border: 2px solid var(--la-text);
        background: #ffffff;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
    }
}
.la-page.la-theme-bold .la-section {
    border: 3px solid var(--la-text);
    border-radius: 12px;
    background: var(--la-surface);
    box-shadow: 8px 8px 0 var(--la-text);
}
.la-page.la-theme-bold .la-hero {
    border-color: var(--la-text);
    background: var(--la-primary);
    color: var(--la-on-primary);
}
.la-page.la-theme-bold .la-hero h1,
.la-page.la-theme-bold .la-hero p,
.la-page.la-theme-bold .la-hero .la-eyebrow {
    color: var(--la-on-primary);
}
.la-page.la-theme-bold .la-cta {
    border: 2px solid var(--la-text);
    box-shadow: 4px 4px 0 var(--la-text);
    font-weight: 800;
}
.la-page.la-theme-bold .la-hero .la-cta {
    background: var(--la-text);
    color: var(--la-surface);
}
.la-page.la-theme-bold .la-cta-outline {
    background: var(--la-surface);
    color: var(--la-text);
    box-shadow: 4px 4px 0 var(--la-text);
}
.la-page.la-theme-minimal .la-section {
    border-radius: 6px;
    box-shadow: none;
}
.la-page.la-theme-minimal .la-hero {
    border-color: var(--la-hairline);
    background: var(--la-surface);
}
.la-page.la-theme-minimal .la-cta {
    border-radius: 4px;
    box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
    .la-page * {
        transition: none !important;
        animation: none !important;
        scroll-behavior: auto !important;
    }
}
.la-page[style*="--la-on-accent"] .la-cta.la-instagram {
    color: var(--la-on-accent);
}
/* theme:end */
`;

const FALLBACK_HTML = `
<section class="la-section la-hero">
    <p class="la-eyebrow">Landing Page</p>
    <h1>Landing page unavailable</h1>
    <p>This page does not have renderable content yet.</p>
</section>
`;

// A <style> element is an HTML "raw text" element: the browser's tokenizer exits
// style-parsing mode purely on seeing the literal case-insensitive sequence
// "</style" (whitespace is never allowed between "</" and the tag name, so no
// other variant terminates it). Since `css` is embedded directly into a static
// <style>...</style> block when Cloudflare serves a published page
// (cloudflarePagesService.ts's buildFullDocument does raw string interpolation,
// not a DOM API), a "</style" substring inside untrusted `css` breaks out of the
// tag and lets arbitrary markup after it execute as real HTML - stored XSS on a
// public page. Stripping the literal terminator sequence keeps everything after
// it inert raw text instead.
function sanitizeCssForStyleTag(css: string): string {
    return css.replace(/<\/style/gi, "");
}

export function withLandingBaseCss(css: string): string {
    const trimmed = sanitizeCssForStyleTag(css.trim());
    if (!trimmed) {
        return LANDING_PAGE_BASE_CSS;
    }
    if (trimmed.includes(".la-section")) {
        return trimmed;
    }
    return `${LANDING_PAGE_BASE_CSS}\n${trimmed}`;
}

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function escapeHtml(value: unknown): string {
    return text(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttribute(value: unknown): string {
    return escapeHtml(value).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

const ALLOWED_HTML_TAGS = new Set([
    "section",
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "a",
    "strong",
    "em",
    "b",
    "i",
    "small",
    "br",
    "img",
]);

const ALLOWED_HTML_ATTRS = new Set([
    "id",
    "class",
    "href",
    "title",
    "target",
    "rel",
    "aria-label",
    "data-section-type",
    "src",
    "alt",
    "loading",
    "width",
    "height",
]);

function sanitizeClassTokens(value: string): string {
    return value
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => token.replace(/[^a-zA-Z0-9:_-]/g, ""))
        .filter(Boolean)
        .join(" ")
        .slice(0, 240);
}

export function isSafeLink(value: string): boolean {
    if (!value) return false;
    if (value.startsWith("#") || value.startsWith("/")) return true;
    if (/^https?:\/\//i.test(value)) return true;
    if (/^mailto:/i.test(value)) return true;
    if (/^tel:/i.test(value)) return true;
    return false;
}

// Landing HTML is untrusted (AI output + editor saves) and is served both on the
// Cloudflare worker and on the app's own origin via /p/[slug], so it goes through
// a real HTML parser (sanitize-html over htmlparser2) rather than a hand-rolled
// tokenizer, and is re-serialized from the parse tree: every attribute value is
// quoted and `&<>"` are re-encoded, so nothing in the output reads back as
// markup. (sanitize-html, not DOMPurify: DOMPurify needs jsdom on the server,
// which added ~66 MiB at boot and OOM-hung api-main - see OPEN-270/OPEN-278.)
// The allow-lists above are unchanged. svg/math and the other raw-text or
// foreign-content containers are dropped together with their content. The
// attribute transform keeps the old sanitizer's extra rules - only isSafeLink
// URLs (so no data: images or javascript:), filtered class tokens, no raw rel,
// target normalised with rel="noopener noreferrer" on _blank - plus a
// DOM-clobbering guard for ids.
const DROP_WITH_CONTENT_TAGS = [
    "script", "style", "textarea", "option", "xmp", "noscript", "title",
    "svg", "math", "template", "iframe", "object", "embed", "noembed", "noframes",
];

// ids that would shadow a document or <form> property a script reads (DOM
// clobbering), which matters on the app's own origin (/p/[slug]). DOMPurify
// dropped any id `in document || in form`; this is the commonly-clobbered subset.
const CLOBBERING_IDS = new Set([
    "cookie", "location", "domain", "URL", "documentURI", "baseURI", "referrer", "origin",
    "body", "head", "documentElement", "defaultView", "currentScript", "activeElement",
    "forms", "images", "links", "scripts", "anchors", "embeds", "plugins", "all", "children",
    "title", "readyState", "implementation", "attributes", "ownerDocument", "parentNode",
    "firstChild", "lastChild", "childNodes", "nodeName", "nodeType", "textContent", "innerHTML",
    "createElement", "getElementById", "getElementsByName", "getElementsByTagName",
    "querySelector", "querySelectorAll", "write", "writeln", "open", "close", "evaluate",
    "appendChild", "insertBefore", "removeChild", "replaceChild", "cloneNode", "contains",
    "addEventListener", "removeEventListener", "dispatchEvent",
    "action", "method", "target", "elements", "submit", "reset", "length", "name",
]);

// Runs on every tag (allowed or not) before sanitize-html's own attribute
// allow-list; values arrive entity-decoded, so `jav&#x61;script:` is caught here.
function sanitizeLandingAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
    const out: sanitizeHtml.Attributes = {};
    for (const [rawName, rawValue] of Object.entries(attribs)) {
        const attrName = rawName.toLowerCase();
        const value = rawValue.trim();
        if (!value || attrName === "rel") continue;
        if ((attrName === "href" || attrName === "src") && !isSafeLink(value)) continue;
        if (attrName === "id" && CLOBBERING_IDS.has(value)) continue;
        if (attrName === "class") {
            const safeClass = sanitizeClassTokens(value);
            if (safeClass) out[attrName] = safeClass;
            continue;
        }
        if (attrName === "target") {
            out[attrName] = value === "_blank" ? "_blank" : "_self";
            if (out[attrName] === "_blank") out["rel"] = "noopener noreferrer";
            continue;
        }
        out[attrName] = value;
    }
    return out;
}

const LANDING_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [...ALLOWED_HTML_TAGS],
    allowedAttributes: { "*": [...ALLOWED_HTML_ATTRS] },
    // Defense in depth: sanitizeLandingAttributes has already applied isSafeLink.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    nonTextTags: DROP_WITH_CONTENT_TAGS,
    transformTags: {
        "*": (tagName, attribs) => ({ tagName, attribs: sanitizeLandingAttributes(attribs) }),
    },
};

function sanitizeLandingHtml(rawHtml: string): string {
    return sanitizeHtml(rawHtml, LANDING_SANITIZE_OPTIONS);
}

// For the public page JSON that apps/web's /p/[slug] renders on the app's own
// origin: clean the raw `html` field here so that path gets the same parser-based
// sanitizer as the Cloudflare one (apps/web still runs its own copy on top).
export function sanitizeRenderedJsonHtml(renderedJson: unknown): unknown {
    if (!renderedJson || typeof renderedJson !== "object" || Array.isArray(renderedJson)) {
        return renderedJson;
    }
    const data = renderedJson as Record<string, unknown>;
    if (typeof data["html"] !== "string") {
        return renderedJson;
    }
    return { ...data, html: sanitizeLandingHtml(data["html"]) };
}

function normalizeSections(value: unknown): LandingPageSectionLike[] {
    if (Array.isArray(value)) {
        return value.filter((section) => section && typeof section === "object") as LandingPageSectionLike[];
    }

    if (value && typeof value === "object") {
        const sections = (value as Record<string, unknown>)["sections"];
        if (Array.isArray(sections)) {
            return sections.filter((section) => section && typeof section === "object") as LandingPageSectionLike[];
        }
    }

    return [];
}

function renderBullets(bullets: unknown): string {
    if (!Array.isArray(bullets) || bullets.length === 0) {
        return "";
    }

    return `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

// Where a section's button goes: the section's own https link (a sales page's booking or
// checkout page), else the page's lead form.
function ctaHref(section: LandingPageSectionLike): string {
    const href = text(section.ctaHref);
    return href && /^https:\/\//i.test(href) && isSafeLink(href) ? escapeHtml(href) : "#lead-form";
}

function renderImage(section: LandingPageSectionLike, altFallback: string): string {
    const src = text(section.imageUrl);
    if (!src || !isSafeLink(src)) {
        return "";
    }
    const alt = escapeHtml(section.imageAlt || altFallback);
    return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />`;
}

function renderSection(section: LandingPageSectionLike, index: number): string {
    const type = text(section.type) || "section";
    const id = escapeAttribute(section.id) || `${type}-${index + 1}`;
    const heading = escapeHtml(section.heading || type.replace(/_/g, " "));
    const body = escapeHtml(section.body);
    const bullets = renderBullets(section.bullets);
    const ctaLabel = escapeHtml(section.ctaLabel);

    if (type === "hero") {
        const image = renderImage(section, heading);
        return `
<section id="${id}" class="la-section la-hero${image ? " la-hero-with-image" : ""}" data-section-type="hero">
    <div class="la-hero-copy">
        <p class="la-eyebrow">Campaign Offer</p>
        <h1>${heading}</h1>
        ${body ? `<p>${body}</p>` : ""}
        ${ctaLabel ? `<a class="la-cta" href="${ctaHref(section)}">${ctaLabel}</a>` : ""}
    </div>
    ${image ? `<div class="la-hero-media">${image}</div>` : ""}
</section>`;
    }

    if (type === "proof" || type === "logos" || type === "testimonial") {
        const image = renderImage(section, heading);
        const sectionClass = type === "testimonial" ? "la-testimonial" : "la-proof";
        return `
<section id="${id}" class="la-section ${sectionClass}" data-section-type="${escapeAttribute(type)}">
    <p class="la-eyebrow">${escapeHtml(type.replace(/_/g, " "))}</p>
    <h2>${heading}</h2>
    ${image}
    ${body ? `<p>${body}</p>` : ""}
    ${bullets}
</section>`;
    }

    if (type === "cta_form") {
        return `
<section id="${id}" class="la-section" data-section-type="cta_form">
    <p class="la-eyebrow">Next Step</p>
    <h2>${heading}</h2>
    ${body ? `<p>${body}</p>` : ""}
    <a class="la-cta" href="${ctaHref(section)}">${ctaLabel || "Request a follow-up"}</a>
</section>`;
    }

    if (type === "footer") {
        return `
<section id="${id}" class="la-section la-footer" data-section-type="footer">
    <h2>${heading}</h2>
    ${body ? `<p>${body}</p>` : ""}
    ${ctaLabel ? `<a class="la-cta" href="${ctaHref(section)}">${ctaLabel}</a>` : ""}
</section>`;
    }

    return `
<section id="${id}" class="la-section" data-section-type="${escapeAttribute(type)}">
    <p class="la-eyebrow">${escapeHtml(type.replace(/_/g, " "))}</p>
    <h2>${heading}</h2>
    ${body ? `<p>${body}</p>` : ""}
    ${bullets}
</section>`;
}

export function renderSectionsToHtml(value: unknown): string {
    const sections = normalizeSections(value);
    if (sections.length === 0) {
        return FALLBACK_HTML;
    }

    return sections.map((section, index) => renderSection(section, index)).join("\n");
}

export function getLandingRenderPayload(renderedJson: unknown): LandingRenderPayload {
    if (renderedJson && typeof renderedJson === "object" && !Array.isArray(renderedJson)) {
        const data = renderedJson as Record<string, unknown>;
        const html = text(data["html"]);
        if (html) {
            const css = text(data["css"]);
            const safeHtml = sanitizeLandingHtml(html);
            return {
                html: safeHtml || FALLBACK_HTML,
                css: withLandingBaseCss(css),
            };
        }

        const sections = normalizeSections(data);
        if (sections.length > 0) {
            return {
                html: renderSectionsToHtml(sections),
                css: LANDING_PAGE_BASE_CSS,
            };
        }
    }

    if (Array.isArray(renderedJson)) {
        return {
            html: renderSectionsToHtml(renderedJson),
            css: LANDING_PAGE_BASE_CSS,
        };
    }

    return {
        html: FALLBACK_HTML,
        css: LANDING_PAGE_BASE_CSS,
    };
}
