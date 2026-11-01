import { z } from "zod";

// Customer page themes. Pure and dependency-free apart from zod, so the editor, the React renderer
// and the Worker document builder all compute the same classes and CSS variables from one function.
// apps/api/src/modules/landing-agent/theme.ts is a copy of this file; a drift test keeps them equal.

export const THEME_PRESETS = ["clean", "glass", "bold", "minimal"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const THEME_FONTS = ["system", "serif", "humanist", "mono"] as const;
export type ThemeFont = (typeof THEME_FONTS)[number];

// Only these stacks can reach the page. The stored theme holds the font key, never a stack string.
const FONT_STACKS: Record<ThemeFont, string> = {
    system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    humanist: 'Verdana, Geneva, "Trebuchet MS", sans-serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export const DEFAULT_THEME_PRIMARY = "#0891b2";
export const DEFAULT_THEME_ACCENT = "#22c55e";

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const AA_TEXT = 4.5;
const INK = "#0f172a";
const WHITE = "#ffffff";
const BLACK = "#000000";
const PAGE_BG = "#f8fafc";
const SURFACE = "#ffffff";
const HAIRLINE = "#dbe4ee";

export const landingThemeSchema = z.strictObject({
    preset: z.enum(THEME_PRESETS).optional(),
    primary: z.string().regex(HEX_COLOUR),
    accent: z.string().regex(HEX_COLOUR),
    font: z.enum(THEME_FONTS).optional(),
});

export type LandingTheme = z.infer<typeof landingThemeSchema>;

// Renderers use this: anything invalid is treated as "no theme" (today's look), never as raw input.
export function parseLandingTheme(value: unknown): LandingTheme | null {
    if (value === undefined || value === null) return null;
    const parsed = landingThemeSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

type RGB = [number, number, number];

function toRgb(hex: string): RGB {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: RGB): string {
    return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

// Linear mix: t is the share of `b`.
function mix(a: string, b: string, t: number): string {
    const from = toRgb(a);
    const to = toRgb(b);
    return toHex([0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * t) as RGB);
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = toRgb(hex).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.x contrast ratio between two #RRGGBB colours.
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Text colour for a solid background: the page ink when it passes AA, otherwise black or white,
// whichever contrasts more. Black or white always reaches 4.58:1 on any colour, so this always passes.
export function textOn(background: string): string {
    if (contrastRatio(INK, background) >= AA_TEXT) return INK;
    return contrastRatio(WHITE, background) >= contrastRatio(BLACK, background) ? WHITE : BLACK;
}

// A brand colour used as TEXT (eyebrows, outline buttons): darken it toward black until it reads at AA.
export function accessibleTint(color: string, against: string): string {
    for (let step = 0; step <= 20; step++) {
        const candidate = mix(color, BLACK, step / 20);
        if (contrastRatio(candidate, against) >= AA_TEXT) return candidate;
    }
    return BLACK;
}

export function themeTokens(theme: LandingTheme): Record<string, string> {
    const primary = theme.primary.toLowerCase();
    const accent = theme.accent.toLowerCase();
    const glass = theme.preset === "glass";
    // Glass sits on a soft two-colour gradient; every other preset sits on the plain page background.
    const background = glass ? mix(primary, WHITE, 0.85) : PAGE_BG;
    const accentWash = mix(accent, WHITE, 0.85);
    // The darkest colour a primary-coloured text can sit on, so the text passes everywhere on the page.
    const textSurface = glass && contrastRatio(accentWash, WHITE) > contrastRatio(background, WHITE) ? accentWash : background;
    return {
        "--la-primary": primary,
        "--la-accent": accent,
        "--la-on-primary": textOn(primary),
        "--la-on-accent": textOn(accent),
        "--la-primary-text": accessibleTint(primary, textSurface),
        "--la-text": textOn(background),
        "--la-bg": background,
        "--la-bg-image": glass ? `linear-gradient(135deg, ${background}, ${accentWash})` : "none",
        "--la-surface": SURFACE,
        "--la-hairline": HAIRLINE,
        "--la-tint": mix(primary, WHITE, 0.9),
        "--la-font": FONT_STACKS[theme.font ?? "system"],
    };
}

// The page wrapper's class and CSS variables. Pages with no theme keep today's exact look.
export function themeWrapper(theme: LandingTheme | null): { className: string; vars: Record<string, string> } {
    if (!theme) return { className: "la-page", vars: {} };
    return {
        className: theme.preset ? `la-page la-theme-${theme.preset}` : "la-page",
        vars: themeTokens(theme),
    };
}

function isHexColour(value: unknown): value is string {
    return typeof value === "string" && HEX_COLOUR.test(value);
}

// Seed for a new page from the team's branding (Team.branding JSON). Only #RRGGBB is used;
// a missing or invalid colour takes today's default, and no valid colour means no seed.
export function brandThemeFrom(branding: unknown): { primary: string; accent: string } | null {
    if (!branding || typeof branding !== "object") return null;
    const data = branding as Record<string, unknown>;
    const primary = isHexColour(data.primaryColor) ? data.primaryColor : null;
    const accent = isHexColour(data.accentColor) ? data.accentColor : null;
    if (!primary && !accent) return null;
    return { primary: primary ?? DEFAULT_THEME_PRIMARY, accent: accent ?? DEFAULT_THEME_ACCENT };
}
