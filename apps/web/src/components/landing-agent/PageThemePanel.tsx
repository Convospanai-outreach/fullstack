import { useState } from "react";
import {
    DEFAULT_THEME_ACCENT,
    DEFAULT_THEME_PRIMARY,
    THEME_FONTS,
    THEME_PRESETS,
    brandThemeFrom,
    themeTokens,
    type LandingTheme,
    type ThemeFont,
    type ThemePreset,
} from "@/modules/landing-agent/theme";

const PRESET_LABELS: Record<ThemePreset, string> = { clean: "Clean", glass: "Glass", bold: "Bold", minimal: "Minimal" };
const FONT_LABELS: Record<ThemeFont, string> = { system: "System (default)", serif: "Serif", humanist: "Humanist", mono: "Monospace" };

interface Props {
    theme: LandingTheme | null;
    onChange: (theme: LandingTheme | null) => void;
}

// The page theme: a preset, two brand colours and a font from the safe list. Every change is passed up
// at once, so the editor previews it in the canvas and saves it with the page.
export default function PageThemePanel({ theme, onChange }: Props) {
    const [brandMessage, setBrandMessage] = useState<string | null>(null);
    const current: LandingTheme = theme ?? { primary: DEFAULT_THEME_PRIMARY, accent: DEFAULT_THEME_ACCENT };

    function update(patch: Partial<LandingTheme>) {
        onChange({ ...current, ...patch });
    }

    function useCurrentLook() {
        const next: LandingTheme = { ...current };
        delete next.preset;
        onChange(next);
    }

    async function useBrandColours() {
        setBrandMessage(null);
        try {
            const res = await fetch("/api/settings/branding", { credentials: "same-origin" });
            const data = (await res.json().catch(() => null)) as { branding?: unknown } | null;
            const brand = brandThemeFrom(data?.branding);
            if (!brand) {
                setBrandMessage("Your team has no brand colours yet. Set them in Settings, Branding, then try again.");
                return;
            }
            update(brand);
        } catch {
            setBrandMessage("Could not load your brand colours. Try again.");
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-400">Pick a look, then your colours and font. Changes show in the canvas.</p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    aria-pressed={!current.preset && theme !== null}
                    disabled={!theme?.preset}
                    onClick={useCurrentLook}
                    className="rounded-lg border border-white/10 px-2 py-2 text-left text-xs text-slate-200 disabled:opacity-60"
                >
                    Current look
                </button>
                {THEME_PRESETS.map((preset) => {
                    const tokens = themeTokens({ preset, primary: current.primary, accent: current.accent });
                    const surface = tokens["--la-bg-image"] !== "none" ? tokens["--la-bg-image"] : tokens["--la-bg"];
                    return (
                        <button
                            key={preset}
                            type="button"
                            aria-pressed={current.preset === preset}
                            onClick={() => update({ preset })}
                            className="space-y-1 rounded-lg border border-white/10 p-2 text-left text-xs text-slate-200"
                        >
                            <span
                                aria-hidden="true"
                                className="block h-8 rounded"
                                style={{ background: surface, border: `1px solid ${tokens["--la-hairline"]}` }}
                            >
                                <span className="block h-2 w-1/2 rounded-b" style={{ background: tokens["--la-primary"] }} />
                            </span>
                            {PRESET_LABELS[preset]}
                        </button>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <label className="flex items-center justify-between gap-2">
                    Primary
                    <input
                        type="color"
                        aria-label="Primary colour"
                        value={current.primary.toLowerCase()}
                        onChange={(e) => update({ primary: e.target.value })}
                        className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                </label>
                <label className="flex items-center justify-between gap-2">
                    Accent
                    <input
                        type="color"
                        aria-label="Accent colour"
                        value={current.accent.toLowerCase()}
                        onChange={(e) => update({ accent: e.target.value })}
                        className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                </label>
            </div>
            <label className="block space-y-1 text-xs text-slate-300">
                Font
                <select
                    value={current.font ?? "system"}
                    onChange={(e) => update({ font: e.target.value as ThemeFont })}
                    className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-slate-100"
                >
                    {THEME_FONTS.map((font) => (
                        <option key={font} value={font}>
                            {FONT_LABELS[font]}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={useBrandColours}
                    className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/5"
                >
                    Use my brand colours
                </button>
                {theme ? (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5"
                    >
                        Remove theme
                    </button>
                ) : null}
            </div>
            {brandMessage ? (
                <p role="status" className="text-xs text-amber-300">
                    {brandMessage}
                </p>
            ) : null}
        </div>
    );
}
