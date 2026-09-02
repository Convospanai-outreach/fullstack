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
    imageUrl?: unknown;
    imageAlt?: unknown;
}

export const LANDING_PAGE_BASE_CSS = `
.la-page {
    background: #f8fafc;
    color: #0f172a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.la-section {
    margin: 0 auto 24px;
    max-width: 960px;
    border: 1px solid #dbe4ee;
    border-radius: 14px;
    background: #ffffff;
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
    color: #0e7490;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}
.la-section h1,
.la-section h2,
.la-section h3 {
    margin: 0;
    color: #0f172a;
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
    background: #0891b2;
    color: #ffffff;
    font-weight: 700;
    padding: 11px 16px;
    text-decoration: none;
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
    .la-hero-with-image {
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
`;

const FALLBACK_HTML = `
<section class="la-section la-hero">
    <p class="la-eyebrow">Landing Page</p>
    <h1>Landing page unavailable</h1>
    <p>This page does not have renderable content yet.</p>
</section>
`;

export function withLandingBaseCss(css: string): string {
    const trimmed = css.trim();
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

function escapeHtml(value: unknown): string {
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

function isSafeLink(value: string): boolean {
    if (!value) return false;
    if (value.startsWith("#") || value.startsWith("/")) return true;
    if (/^https?:\/\//i.test(value)) return true;
    if (/^mailto:/i.test(value)) return true;
    if (/^tel:/i.test(value)) return true;
    return false;
}

function sanitizeLandingHtml(rawHtml: string): string {
    const withoutDangerousBlocks = rawHtml
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
        .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "");

    return withoutDangerousBlocks.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, rawTagName: string, rawAttrs: string) => {
        const tagName = rawTagName.toLowerCase();
        const isClosing = match.startsWith("</");
        if (!ALLOWED_HTML_TAGS.has(tagName)) {
            return "";
        }
        if (isClosing) {
            return `</${tagName}>`;
        }

        const attrs: string[] = [];
        rawAttrs.replace(
            /([a-zA-Z0-9:_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
            (_full: string, rawAttrName: string, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
                const attrName = rawAttrName.toLowerCase();
                if (attrName.startsWith("on") || attrName === "style") {
                    return "";
                }
                if (!ALLOWED_HTML_ATTRS.has(attrName)) {
                    return "";
                }

                const rawValue = String(doubleQuoted ?? singleQuoted ?? unquoted ?? "").trim();
                if (!rawValue) {
                    return "";
                }

                if (attrName === "href" && !isSafeLink(rawValue)) {
                    return "";
                }
                if (attrName === "src" && !isSafeLink(rawValue)) {
                    return "";
                }
                if (attrName === "class") {
                    const safeClass = sanitizeClassTokens(rawValue);
                    if (!safeClass) return "";
                    attrs.push(`class="${safeClass}"`);
                    return "";
                }
                if (attrName === "target") {
                    const safeTarget = rawValue === "_blank" ? "_blank" : "_self";
                    attrs.push(`target="${safeTarget}"`);
                    if (safeTarget === "_blank") {
                        attrs.push(`rel="noopener noreferrer"`);
                    }
                    return "";
                }
                if (attrName === "rel") {
                    // rel is controlled when target="_blank"; ignore direct raw rel to avoid spoofing.
                    return "";
                }

                attrs.push(`${attrName}="${escapeHtml(rawValue)}"`);
                return "";
            }
        );

        return `<${tagName}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
    });
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
        ${ctaLabel ? `<a class="la-cta" href="#lead-form">${ctaLabel}</a>` : ""}
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
    <a class="la-cta" href="#lead-form">${ctaLabel || "Request a follow-up"}</a>
</section>`;
    }

    if (type === "footer") {
        return `
<section id="${id}" class="la-section la-footer" data-section-type="footer">
    <h2>${heading}</h2>
    ${body ? `<p>${body}</p>` : ""}
    ${ctaLabel ? `<a class="la-cta" href="#lead-form">${ctaLabel}</a>` : ""}
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
