import { classifyImageSource } from "@/components/landing-agent/imageSources";

// Builds a hero block that uses one image, for the editor's Images panel. The markup
// uses the same classes as the static hero blocks in editorConfig.ts, so the sanitizer
// and the published CSS treat it the same way. Returns null when the image or alt text
// is not acceptable, so the editor never adds an image without alt text.

export type HeroImageLayout = "background" | "side" | "top";
export type FocalPoint = "top" | "center" | "bottom";
export type OverlayStrength = 0 | 20 | 40 | 60;

export const HERO_IMAGE_LAYOUTS: readonly { value: HeroImageLayout; label: string }[] = [
    { value: "background", label: "Full-width image behind text" },
    { value: "side", label: "Image beside text" },
    { value: "top", label: "Image above headline" },
];

export const FOCAL_POINTS: readonly { value: FocalPoint; label: string }[] = [
    { value: "top", label: "Top" },
    { value: "center", label: "Centre" },
    { value: "bottom", label: "Bottom" },
];

export const OVERLAY_STRENGTHS: readonly { value: OverlayStrength; label: string }[] = [
    { value: 0, label: "None" },
    { value: 20, label: "Light" },
    { value: 40, label: "Medium" },
    { value: 60, label: "Strong" },
];

export interface HeroImageInput {
    layout: HeroImageLayout;
    src: string;
    alt: string;
    focal: FocalPoint;
    darken: OverlayStrength;
}

function escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const COPY = `<p class="la-eyebrow">Your offer</p>
        <h1>Headline</h1>
        <p>Core value proposition for your audience.</p>
        <a class="la-cta" href="#lead-form">Call to action</a>`;

export function buildHeroImageHtml(input: HeroImageInput): string | null {
    const src = input.src.trim();
    const alt = input.alt.trim();
    if (!alt || classifyImageSource(src) === "rejected") return null;

    const safeSrc = escapeAttribute(src);
    const safeAlt = escapeAttribute(alt);

    if (input.layout === "background") {
        const overlay = input.darken ? `<div class="la-overlay la-overlay-${input.darken}"></div>` : "";
        return `<section class="la-section la-hero la-hero-bg">
    <img class="la-hero-bg-img la-focus-${input.focal}" src="${safeSrc}" alt="${safeAlt}" loading="lazy" />
    ${overlay}
    <div class="la-hero-bg-content">
        ${COPY}
    </div>
</section>`;
    }

    const image = `<img class="la-focus-${input.focal}" src="${safeSrc}" alt="${safeAlt}" loading="lazy" />`;
    if (input.layout === "side") {
        return `<section class="la-section la-hero la-hero-with-image">
    <div class="la-hero-copy">
        ${COPY}
    </div>
    <div class="la-hero-media">${image}</div>
</section>`;
    }

    return `<section class="la-section la-hero la-hero-top">
    <div class="la-hero-media">${image}</div>
    ${COPY}
</section>`;
}
