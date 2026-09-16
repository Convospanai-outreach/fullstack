"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CrystalSetupCard, type CrystalSettings } from "@/components/crystal-knows/CrystalSetupCard";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

export default function CrystalKnowsSettingsPage() {
    const [settings, setSettings] = useState<CrystalSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch(`${API_BASE}/crystal-knows/settings`)
            .then((res) => (res.ok ? res.json() : { hasKey: false, configuredAt: null }))
            .then((json) => { if (!cancelled) setSettings(json); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="space-y-6 max-w-2xl">
            <SectionHeader
                title="Crystal Knows"
                subtitle="Connect a Crystal Knows API key to enrich leads with DISC personality data and tailor AI-drafted outreach to each recipient's communication style."
            />
            {!loading && settings && <CrystalSetupCard settings={settings} onSaved={setSettings} />}
        </div>
    );
}
