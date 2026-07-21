"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, Download, Globe2, Languages, Loader2, MapPinned, Presentation, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { ToneSlider } from "@/components/studio/ToneSlider";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
    buildCampaignPreview,
    buildDeckPreview,
    buildDeckSlides,
    DEFAULT_STUDIO_CONFIG,
    getLanguageMeta,
    LANGUAGES,
    MARKETS,
    normalizeStudioConfig,
    type Channel,
    type StudioConfig,
} from "@/modules/studio/presentation";

function getDownloadFileName(disposition: string | null) {
    if (!disposition) return "international-campaign-deck.pptx";

    const match = disposition.match(/filename="([^"]+)"/i);
    return match?.[1] || "international-campaign-deck.pptx";
}

export default function StudioClient() {
    const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
    const [channel, setChannel] = useState<Channel>("email");
    const [preview, setPreview] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch((process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/studio/config");
                const data = await res.json();

                if (data.config) {
                    setConfig(normalizeStudioConfig(data.config));
                }
            } catch (error) {
                console.error("Failed to load studio config", error);
            }
        };

        void loadConfig();
    }, []);

    useEffect(() => {
        setPreview(channel === "deck" ? buildDeckPreview(config) : buildCampaignPreview(config));
    }, [channel, config]);

    const slideCards = useMemo(() => buildDeckSlides(config.slideOutline), [config.slideOutline]);
    const languageMeta = useMemo(() => getLanguageMeta(config.language), [config.language]);

    const handleRegenerate = async () => {
        setLoading(true);

        try {
            const talkingPoints = config.talkingPoints.split("\n").map((item) => item.trim()).filter(Boolean);
            const avoidWords = config.avoidWords.split(",").map((item) => item.trim()).filter(Boolean);

            const res = await fetch((process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/studio/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    context: `Target language: ${languageMeta.label}. Market: ${config.market}. Audience: ${config.audience}. Audience needs: ${config.audienceNeeds}.`,
                    mission: channel === "deck"
                        ? `Create a PowerPoint-ready storyline for "${config.deckTitle}" with the goal "${config.presentationGoal}". Requirements: ${config.contentRequirements}. Slide outline: ${config.slideOutline}.`
                        : `Write campaign content for "${config.campaignObjective}" in ${languageMeta.label} for ${config.audience}. Requirements: ${config.contentRequirements}.`,
                    config: {
                        formality: config.formality,
                        directness: config.directness,
                        talkingPoints,
                        avoidWords,
                        language: config.language,
                        market: config.market,
                        audience: config.audience,
                        presentationGoal: config.presentationGoal,
                    }
                })
            });

            const json = await res.json();
            if (!res.ok || json.error) {
                throw new Error(json.error || "Failed to generate preview");
            }

            setPreview(json.response);
            toast.success(channel === "deck" ? "Deck narrative regenerated" : "Campaign content regenerated");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to generate preview");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            const res = await fetch((process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/studio/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...config,
                    talkingPoints: config.talkingPoints.split("\n").map((item) => item.trim()).filter(Boolean),
                    avoidWords: config.avoidWords.split(",").map((item) => item.trim()).filter(Boolean),
                })
            });

            if (!res.ok) {
                throw new Error("Failed to save");
            }

            toast.success("International campaign studio saved");
        } catch (_error) {
            toast.error("Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    const handleExportDeck = async () => {
        setExporting(true);

        try {
            const res = await fetch("/api/studio/presentation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config, preview }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error || "Failed to generate PowerPoint deck");
            }

            const blob = await res.blob();
            const fileName = getDownloadFileName(res.headers.get("Content-Disposition"));
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);

            toast.success("Editable PowerPoint deck downloaded");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to export PowerPoint deck");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-8">
            <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_26%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(135deg,rgba(7,18,32,0.98),rgba(20,32,49,0.96))] p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-100">
                            <Languages className="h-3.5 w-3.5" />
                            International Campaign Studio
                        </div>
                        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
                            Edit campaign language, audience fit, and PowerPoint narrative in one place.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                            Build content that looks global, sounds local, and stays editable for the team preparing outreach,
                            executive decks, and follow-up collateral.
                        </p>
                        <div className="mt-6 text-xs uppercase tracking-[0.28em] text-slate-400">
                            Hello - Bonjour - Hola - Namaste - Marhaba - Konnichiwa
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Language</div>
                            <div className="mt-2 text-sm font-medium text-white">{languageMeta.label}</div>
                            <div className="mt-1 text-xs text-slate-400">{languageMeta.nativeLabel}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Direction</div>
                            <div className="mt-2 text-sm font-medium text-white">{languageMeta.direction.toUpperCase()}</div>
                            <div className="mt-1 text-xs text-slate-400">{languageMeta.region}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Deck output</div>
                            <div className="mt-2 text-sm font-medium text-white">Editable PPTX</div>
                            <div className="mt-1 text-xs text-slate-400">PowerPoint-native text boxes</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <section className="lg:col-span-5 flex flex-col gap-6">
                    <GlassCard className="flex flex-col gap-5">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Language and market</h2>
                            <p className="mt-1 text-sm text-slate-400">Give every campaign a clear linguistic and regional context.</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="studio-language" className="text-sm font-medium text-slate-300">Language</label>
                                <select
                                    id="studio-language"
                                    value={config.language}
                                    onChange={(e) => setConfig((prev) => ({ ...prev, language: e.target.value }))}
                                    className="h-11 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-400"
                                >
                                    {LANGUAGES.map((language) => (
                                        <option key={language.value} value={language.value} className="bg-slate-950">
                                            {language.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="studio-market" className="text-sm font-medium text-slate-300">Market</label>
                                <select
                                    id="studio-market"
                                    value={config.market}
                                    onChange={(e) => setConfig((prev) => ({ ...prev, market: e.target.value }))}
                                    className="h-11 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-400"
                                >
                                    {MARKETS.map((market) => (
                                        <option key={market} value={market} className="bg-slate-950">
                                            {market}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-emerald-200/80">
                                <MapPinned className="h-3.5 w-3.5" />
                                Locale Signal
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs text-slate-500">Native label</div>
                                    <div className="mt-1 text-sm text-white">{languageMeta.nativeLabel}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Reading direction</div>
                                    <div className="mt-1 text-sm text-white">{languageMeta.direction.toUpperCase()}</div>
                                </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-300">{languageMeta.signal}</p>
                        </div>

                        <Input
                            label="Campaign objective"
                            value={config.campaignObjective}
                            onChange={(e) => setConfig((prev) => ({ ...prev, campaignObjective: e.target.value }))}
                            placeholder="What should this campaign achieve?"
                        />

                        <div className="space-y-2">
                            <label htmlFor="studio-audience" className="text-sm font-medium text-slate-300">Target audience</label>
                            <textarea
                                id="studio-audience"
                                value={config.audience}
                                onChange={(e) => setConfig((prev) => ({ ...prev, audience: e.target.value }))}
                                className="min-h-[88px] w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                placeholder="Who is the campaign for?"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="studio-audience-needs" className="text-sm font-medium text-slate-300">Audience needs and buying context</label>
                            <textarea
                                id="studio-audience-needs"
                                value={config.audienceNeeds}
                                onChange={(e) => setConfig((prev) => ({ ...prev, audienceNeeds: e.target.value }))}
                                className="min-h-[96px] w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                placeholder="What do they need to hear, prove, or avoid?"
                            />
                        </div>
                    </GlassCard>

                    <GlassCard className="flex flex-col gap-5">
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-cyan-300" />
                            <h2 className="text-lg font-semibold text-white">Voice and constraints</h2>
                        </div>

                        <ToneSlider
                            label="Formality"
                            leftLabel="Conversational"
                            rightLabel="Executive"
                            defaultValue={config.formality}
                            onChange={(value) => setConfig((prev) => ({ ...prev, formality: value }))}
                        />

                        <ToneSlider
                            label="Directness"
                            leftLabel="Consultative"
                            rightLabel="Bold"
                            defaultValue={config.directness}
                            onChange={(value) => setConfig((prev) => ({ ...prev, directness: value }))}
                        />

                        <div className="space-y-2">
                            <label htmlFor="studio-points" className="text-sm font-medium text-slate-300">Key talking points</label>
                            <textarea
                                id="studio-points"
                                className="min-h-[110px] w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                placeholder="One point per line"
                                value={config.talkingPoints}
                                onChange={(e) => setConfig((prev) => ({ ...prev, talkingPoints: e.target.value }))}
                            />
                        </div>

                        <Input
                            label="Avoid words"
                            hint="Comma-separated words or phrases to exclude"
                            placeholder="cheap, aggressive, unrealistic claims"
                            value={config.avoidWords}
                            onChange={(e) => setConfig((prev) => ({ ...prev, avoidWords: e.target.value }))}
                        />

                        <div className="space-y-2">
                            <label htmlFor="studio-reqs" className="text-sm font-medium text-slate-300">Content requirements</label>
                            <textarea
                                id="studio-reqs"
                                value={config.contentRequirements}
                                onChange={(e) => setConfig((prev) => ({ ...prev, contentRequirements: e.target.value }))}
                                className="min-h-[100px] w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                placeholder="Describe compliance, tone, regional nuance, and editing needs"
                            />
                        </div>
                    </GlassCard>

                    <GlassCard className="flex flex-col gap-5">
                        <div className="flex items-center gap-2">
                            <Presentation className="h-4 w-4 text-amber-300" />
                            <h2 className="text-lg font-semibold text-white">PPT and deck editing</h2>
                        </div>

                        <Input
                            label="Deck title"
                            value={config.deckTitle}
                            onChange={(e) => setConfig((prev) => ({ ...prev, deckTitle: e.target.value }))}
                            placeholder="Name of the deck or presentation"
                        />

                        <Input
                            label="Presentation goal"
                            value={config.presentationGoal}
                            onChange={(e) => setConfig((prev) => ({ ...prev, presentationGoal: e.target.value }))}
                            placeholder="What should the deck help the campaign achieve?"
                        />

                        <div className="space-y-2">
                            <label htmlFor="studio-slides" className="text-sm font-medium text-slate-300">Slide outline</label>
                            <textarea
                                id="studio-slides"
                                value={config.slideOutline}
                                onChange={(e) => setConfig((prev) => ({ ...prev, slideOutline: e.target.value }))}
                                className="min-h-[132px] w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                placeholder={"1. Problem framing\n2. Audience pain points\n3. Solution and proof"}
                            />
                            <p className="text-xs text-slate-500">One line per slide. The exported deck stays editable in PowerPoint for local teams.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                            Exported PPTs use editable text boxes, regional brief panels, and speaker notes pulled from this Studio brief.
                        </div>

                        <Link href="/templates" className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200">
                            <Globe2 className="h-4 w-4" />
                            Refine reusable templates after saving this brief
                        </Link>
                    </GlassCard>
                </section>

                <section className="lg:col-span-7 flex flex-col gap-6">
                    <GlassCard className="flex flex-col gap-5 overflow-hidden bg-gradient-to-br from-slate-950/90 to-slate-900/70">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Localized preview</h2>
                                <p className="mt-1 text-sm text-slate-400">Switch between campaign copy and PowerPoint-ready structure.</p>
                            </div>

                            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
                                {([
                                    { id: "email", label: "Campaign Copy" },
                                    { id: "deck", label: "PPT Narrative" },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setChannel(tab.id)}
                                        className={`rounded-full px-4 py-2 text-sm transition ${
                                            channel === tab.id
                                                ? "bg-cyan-300 text-slate-950"
                                                : "text-slate-300 hover:text-white"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                            <div className="min-h-[24rem] rounded-[24px] border border-white/10 bg-slate-950/70 p-5 font-mono text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                                {loading ? (
                                    <div className="flex h-full items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
                                    </div>
                                ) : (
                                    preview
                                    )}
                            </div>

                            <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-200/80">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Editable Slide Plan
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Native label</div>
                                        <div className="mt-2 text-sm text-white">{languageMeta.nativeLabel}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Direction</div>
                                        <div className="mt-2 text-sm text-white">{languageMeta.direction.toUpperCase()}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Audience fit</div>
                                        <div className="mt-2 text-sm text-white line-clamp-2">{config.market}</div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-300">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                                        <ArrowRightLeft className="h-3.5 w-3.5" />
                                        International cue
                                    </div>
                                    <p className="mt-2">{languageMeta.signal}</p>
                                </div>

                                <div className="space-y-3">
                                    {slideCards.map((slide) => (
                                        <div key={slide.index} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Slide {slide.index}</div>
                                            <h3 className="mt-1 text-sm font-semibold text-white">{slide.title}</h3>
                                            <p className="mt-2 text-sm leading-6 text-slate-300">{slide.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                            <div className="flex items-center gap-2 text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" />
                                Language remains editable throughout the Studio brief and exported PowerPoint.
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                className="px-4 py-2 text-slate-300 transition hover:text-white disabled:opacity-50"
                                disabled={loading || exporting}
                            >
                                Regenerate
                            </button>
                            <button
                                type="button"
                                onClick={handleExportDeck}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2 text-sm text-white transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-50"
                                disabled={loading || exporting}
                            >
                                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                {exporting ? "Building PPTX..." : "Export Editable PPTX"}
                            </button>
                            <PrimaryButton disabled={loading || saving || exporting} onClick={handleSave}>
                                {saving ? "Saving..." : "Save Studio Brief"}
                            </PrimaryButton>
                        </div>
                    </GlassCard>
                </section>
            </div>
        </div>
    );
}
