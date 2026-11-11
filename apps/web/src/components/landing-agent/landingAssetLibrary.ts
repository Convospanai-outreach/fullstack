// Built-in header images that ship in apps/web/public/landing-assets/. Pure data
// for the editor's library panel; the files are plain SVG gradients and patterns.

export type LandingAsset = { id: string; label: string; path: string; alt: string };

export const LANDING_ASSET_LIBRARY: readonly LandingAsset[] = [
    { id: "gradient-1", label: "Blue wave", path: "/landing-assets/gradient-1.svg", alt: "Blue gradient wave" },
    { id: "gradient-2", label: "Teal glow", path: "/landing-assets/gradient-2.svg", alt: "Teal gradient glow" },
    { id: "gradient-3", label: "Night dots", path: "/landing-assets/gradient-3.svg", alt: "Dark slate background with dots" },
    { id: "gradient-4", label: "Sunrise", path: "/landing-assets/gradient-4.svg", alt: "Warm amber sunrise gradient" },
    { id: "gradient-5", label: "Mint grid", path: "/landing-assets/gradient-5.svg", alt: "Mint gradient with grid lines" },
    { id: "gradient-6", label: "Slate lines", path: "/landing-assets/gradient-6.svg", alt: "Slate gradient with diagonal lines" },
    { id: "gradient-7", label: "Soft amber", path: "/landing-assets/gradient-7.svg", alt: "Soft amber gradient with rings" },
    { id: "gradient-8", label: "Ocean rings", path: "/landing-assets/gradient-8.svg", alt: "Ocean blue gradient with concentric rings" },
];
