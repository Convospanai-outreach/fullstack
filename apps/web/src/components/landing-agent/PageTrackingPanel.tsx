"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { LandingPageTracking } from "@/modules/landing-agent/types";

// Same formats apps/api enforces (modules/landing-agent/tracking.ts).
const FIELDS = [
    { key: "ga4Id", label: "Google Analytics 4 measurement ID", placeholder: "G-XXXXXXXXXX", pattern: /^G-[A-Z0-9]{4,12}$/ },
    { key: "gtmId", label: "Google Tag Manager container ID", placeholder: "GTM-XXXXXXX", pattern: /^GTM-[A-Z0-9]{4,10}$/ },
    { key: "hotjarId", label: "Hotjar site ID", placeholder: "1234567", pattern: /^\d{5,10}$/ },
    { key: "metaPixelId", label: "Meta Pixel ID", placeholder: "123456789012345", pattern: /^\d{5,20}$/ },
    { key: "metaTestEventCode", label: "Meta test event code (optional)", placeholder: "TEST12345", pattern: /^[A-Za-z0-9_-]{1,40}$/ },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export default function PageTrackingPanel({
    initial,
    onSave,
}: {
    initial?: LandingPageTracking | null;
    onSave: (tracking: Record<Key, string>) => Promise<string>;
}) {
    const [values, setValues] = useState<Record<Key, string>>({
        ga4Id: initial?.ga4Id ?? "",
        gtmId: initial?.gtmId ?? "",
        hotjarId: initial?.hotjarId ?? "",
        metaPixelId: initial?.metaPixelId ?? "",
        metaTestEventCode: initial?.metaTestEventCode ?? "",
    });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const invalid = FIELDS.filter((f) => values[f.key] && !f.pattern.test(values[f.key]));

    return (
        <GlassCard className="p-6 space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Tracking</h2>
                <p className="text-sm text-muted-foreground">
                    These run only when the page is opened on your connected domain (Settings &rarr; Branding), never on
                    the craftmyfunnel.live preview link. Leave a field empty to turn that tool off.
                </p>
            </div>
            <form
                className="grid gap-4 md:grid-cols-3"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (invalid.length) return;
                    setSaving(true);
                    setMessage(null);
                    try {
                        setMessage({ ok: true, text: await onSave(values) });
                    } catch (err: any) {
                        setMessage({ ok: false, text: err?.message || "Could not save tracking IDs" });
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                {FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                        <label htmlFor={`tracking-${field.key}`} className="text-sm text-foreground">{field.label}</label>
                        <input
                            id={`tracking-${field.key}`}
                            type="text"
                            value={values[field.key]}
                            onChange={(e) => setValues({ ...values, [field.key]: e.target.value.trim().toUpperCase() })}
                            placeholder={field.placeholder}
                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground"
                            aria-invalid={invalid.includes(field)}
                        />
                        {invalid.includes(field) ? <p className="text-xs text-destructive">Expected a value like {field.placeholder}</p> : null}
                    </div>
                ))}
                <div className="md:col-span-3 flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving || invalid.length > 0}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save tracking"}
                    </button>
                    {message ? <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p> : null}
                </div>
            </form>
        </GlassCard>
    );
}
