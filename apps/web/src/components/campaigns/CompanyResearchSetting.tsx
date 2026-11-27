"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { researchCostLines } from "@/lib/companyResearch";

// Optional per-campaign switch for researching each lead's company before the first email is
// written. Shows what it costs before it is turned on.
export function CompanyResearchSetting({ campaignId, enabled, leadCount }: { campaignId: string; enabled: boolean; leadCount: number }) {
    const [on, setOn] = useState(enabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function toggle(next: boolean) {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyResearch: next }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save this setting.");
            setOn(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save this setting.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <GlassCard className="space-y-2 p-4">
            <h3 className="font-semibold">Company research before the first email</h3>
            <p className="text-sm text-muted-foreground">
                Reads each lead&apos;s company website and recent news, then writes the email around something real: a recent post or news item, a question their buyers ask, and the offer of yours that answers it.
                When there is not enough to go on, the lead is held for your review instead of getting a generic email.
            </p>
            <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={on} disabled={saving} onChange={(e) => void toggle(e.target.checked)} />
                Research each company first
            </label>
            {researchCostLines(leadCount).map((line) => (
                <p key={line} className="text-xs text-muted-foreground">{line}</p>
            ))}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </GlassCard>
    );
}
