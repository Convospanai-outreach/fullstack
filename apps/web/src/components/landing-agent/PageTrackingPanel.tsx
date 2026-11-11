"use client";

import { useEffect, useState } from "react";
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
    metaTokenSaved,
    onSaveMetaToken,
    onClearMetaToken,
}: {
    initial?: LandingPageTracking | null;
    onSave: (tracking: Record<Key, string>) => Promise<string>;
    // Team-level Meta Conversions API token: write-only. Only "saved" or not is ever shown.
    metaTokenSaved?: boolean;
    onSaveMetaToken?: (token: string) => Promise<string>;
    onClearMetaToken?: () => Promise<string>;
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
    const [token, setToken] = useState("");
    const [tokenSaved, setTokenSaved] = useState(Boolean(metaTokenSaved));
    const [tokenMessage, setTokenMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [tokenBusy, setTokenBusy] = useState(false);

    useEffect(() => {
        setTokenSaved(Boolean(metaTokenSaved));
    }, [metaTokenSaved]);

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
            {onSaveMetaToken ? (
                <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold text-foreground">Meta server-side token (Conversions API)</h3>
                    <p className="text-xs text-muted-foreground">
                        Sends each lead to Meta from the server, so Meta can count it even when the browser Pixel is blocked.
                    </p>
                    {tokenSaved ? (
                        <p className="text-sm text-emerald-600">Access token saved. It is stored encrypted and never shown again.</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No access token saved yet.</p>
                    )}
                    <label htmlFor="meta-capi-token" className="block text-sm text-foreground">
                        {tokenSaved ? "Replace the access token" : "Access token"}
                    </label>
                    <input
                        id="meta-capi-token"
                        type="password"
                        autoComplete="off"
                        value={token}
                        onChange={(e) => setToken(e.target.value.trim())}
                        className="w-full md:w-96 bg-background border border-input rounded-lg px-3 py-2 text-foreground"
                    />
                    <div className="flex items-center gap-3">
                        <button
                            id="meta-capi-token-save"
                            type="button"
                            disabled={!token || tokenBusy}
                            onClick={async () => {
                                setTokenBusy(true);
                                setTokenMessage(null);
                                try {
                                    const text = await onSaveMetaToken(token);
                                    setToken("");
                                    setTokenSaved(true);
                                    setTokenMessage({ ok: true, text });
                                } catch (err: any) {
                                    setTokenMessage({ ok: false, text: err?.message || "Could not save the token" });
                                } finally {
                                    setTokenBusy(false);
                                }
                            }}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
                        >
                            Save token
                        </button>
                        {tokenSaved && onClearMetaToken ? (
                            <button
                                type="button"
                                disabled={tokenBusy}
                                onClick={async () => {
                                    setTokenBusy(true);
                                    try {
                                        setTokenMessage({ ok: true, text: await onClearMetaToken() });
                                        setTokenSaved(false);
                                    } catch (err: any) {
                                        setTokenMessage({ ok: false, text: err?.message || "Could not remove the token" });
                                    } finally {
                                        setTokenBusy(false);
                                    }
                                }}
                                className="text-sm text-destructive underline disabled:opacity-50"
                            >
                                Remove token
                            </button>
                        ) : null}
                    </div>
                    {tokenMessage ? <p className={`text-sm ${tokenMessage.ok ? "text-emerald-600" : "text-destructive"}`}>{tokenMessage.text}</p> : null}
                </div>
            ) : null}
        </GlassCard>
    );
}
