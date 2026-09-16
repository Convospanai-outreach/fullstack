"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CrystalSetupCard, type CrystalSettings } from "@/components/crystal-knows/CrystalSetupCard";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

export default function CrystalKnowsSettingsPage() {
    const [settings, setSettings] = useState<CrystalSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/crystal-knows/settings`);
                if (res.status === 403) {
                    // A 403 (not ADMIN) is not "no key connected" - collapsing them
                    // together shows a non-admin an unusable "connect" form instead
                    // of an explanation of why they can't see the real state.
                    if (!cancelled) setError("Only a team admin can view or change the Crystal Knows connection.");
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!cancelled) setSettings(json);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load Crystal Knows settings.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="space-y-6 max-w-2xl">
            <SectionHeader
                title="Crystal Knows"
                subtitle="Connect a Crystal Knows API key to enrich leads with DISC personality data and tailor AI-drafted outreach to each recipient's communication style."
            />
            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs p-4">
                    {error}
                </div>
            )}
            {!loading && !error && settings && <CrystalSetupCard settings={settings} onSaved={setSettings} />}
        </div>
    );
}
