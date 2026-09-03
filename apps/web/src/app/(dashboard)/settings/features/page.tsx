"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    EyeOff,
    Lock,
    Sparkles,
    ToggleLeft,
    ToggleRight,
} from "lucide-react";

type HiddenFeatureStatus = {
    key: string;
    label: string;
    description: string;
    openPath: string;
    pathPrefixes: string[];
    built: boolean;
    enabled: boolean;
    ready: boolean;
    readinessReason: string;
    recommendedAction: string;
};

type HiddenFeatureResponse = {
    defaults: string[];
    features: HiddenFeatureStatus[];
};

export default function HiddenFeaturesPage() {
    const searchParams = useSearchParams();
    const requestedFeature = searchParams.get("feature");
    const [data, setData] = useState<HiddenFeatureResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch("/api/settings/hidden-features", { cache: "no-store" });
                if (!res.ok) {
                    throw new Error("Failed to load hidden features");
                }

                const payload = await res.json();
                if (!cancelled) {
                    setData(payload);
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error("Failed to load hidden features");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const highlightedFeature = useMemo(() => {
        if (!requestedFeature || !data) {
            return null;
        }

        return data.features.find((feature) => feature.key === requestedFeature) || null;
    }, [data, requestedFeature]);

    async function updateFeatures(nextFeatures: HiddenFeatureStatus[], targetKey: string) {
        setSavingKey(targetKey);
        setData((previous) => previous ? { ...previous, features: nextFeatures } : previous);

        try {
            const enabledFeatures = nextFeatures.filter((feature) => feature.enabled).map((feature) => feature.key);
            const res = await fetch("/api/settings/hidden-features", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledFeatures }),
            });

            if (!res.ok) {
                throw new Error("Failed to update hidden features");
            }

            const enabledFeatureSet = new Set(enabledFeatures);
            setData((previous) => previous ? {
                ...previous,
                features: previous.features.map((feature) => ({
                    ...feature,
                    enabled: enabledFeatureSet.has(feature.key),
                })),
            } : previous);

            const target = nextFeatures.find((feature) => feature.key === targetKey);
            toast.success(target?.enabled ? `${target?.label} is now visible` : `${target?.label} is hidden again`);
        } catch (error) {
            toast.error("Failed to update the feature switch");
            startTransition(() => {
                window.location.reload();
            });
        } finally {
            setSavingKey(null);
        }
    }

    function toggleFeature(featureKey: string) {
        if (!data) {
            return;
        }

        const nextFeatures = data.features.map((feature) => (
            feature.key === featureKey
                ? { ...feature, enabled: !feature.enabled }
                : feature
        ));

        updateFeatures(nextFeatures, featureKey);
    }

    if (loading) {
        return <div className="p-8 text-foreground">Loading feature switches...</div>;
    }

    if (!data) {
        return <div className="p-8 text-foreground">Unable to load hidden features.</div>;
    }

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Feature Switches"
                subtitle="Keep unfinished surfaces hidden by default, then expose them from one place when the right data or runtime is ready."
            />

            {highlightedFeature && (
                <GlassCard className="p-5 border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                        <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">
                                {highlightedFeature.label} is still hidden
                            </div>
                            <p className="text-sm text-foreground">
                                You tried to open this area directly. Turn it on here when you want it visible.
                            </p>
                        </div>
                    </div>
                </GlassCard>
            )}

            <div className="grid gap-4">
                {data.features.map((feature) => {
                    const isSaving = savingKey === feature.key;

                    return (
                        <GlassCard
                            key={feature.key}
                            className={`p-5 transition-all ${
                                requestedFeature === feature.key
                                    ? "border-blue-500/40 bg-blue-500/5"
                                    : "border-border"
                            }`}
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-lg font-semibold text-foreground">{feature.label}</h2>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                            feature.enabled
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : "bg-muted text-foreground"
                                        }`}>
                                            {feature.enabled ? "Visible" : "Hidden"}
                                        </span>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                            feature.ready
                                                ? "bg-blue-500/15 text-blue-300"
                                                : "bg-amber-500/15 text-amber-300"
                                        }`}>
                                            {feature.ready ? "Ready" : "Needs Setup"}
                                        </span>
                                    </div>

                                    <p className="text-sm text-foreground">{feature.description}</p>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl border border-border bg-muted p-3">
                                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {feature.ready ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                                ) : (
                                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                )}
                                                Readiness
                                            </div>
                                            <p className="text-sm text-foreground">{feature.readinessReason}</p>
                                        </div>

                                        <div className="rounded-xl border border-border bg-muted p-3">
                                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                Suggested Action
                                            </div>
                                            <p className="text-sm text-foreground">{feature.recommendedAction}</p>
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        Route prefixes: {feature.pathPrefixes.join(", ")}
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-3 lg:items-end">
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => toggleFeature(feature.key)}
                                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                                            feature.enabled
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                                : "border-border bg-muted text-foreground hover:bg-muted"
                                        } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
                                    >
                                        {feature.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        {isSaving ? "Saving..." : feature.enabled ? "Hide Again" : "Turn On"}
                                    </button>

                                    {feature.enabled && feature.built ? (
                                        <Link
                                            href={feature.openPath}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                                        >
                                            Open Surface
                                            <ExternalLink className="w-4 h-4" />
                                        </Link>
                                    ) : feature.enabled && !feature.built ? (
                                        <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-amber-200">
                                            Not built yet
                                            <AlertTriangle className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground">
                                            Hidden Route
                                            <EyeOff className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
}
