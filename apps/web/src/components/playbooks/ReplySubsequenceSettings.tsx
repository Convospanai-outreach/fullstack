"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type Config = { enabled: boolean; steps: number[] };
type SettingsResponse = { config: Config | null; canEdit: boolean; masterEnabled: boolean };

async function request(path: string, config?: Config): Promise<SettingsResponse> {
    const response = await fetch(getBrowserApiUrl(path), config ? {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config),
    } : undefined);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load follow-up options.");
    return data;
}

export function ReplySubsequenceSettings({ campaignId }: { campaignId: string }) {
    const path = `/drip-playbooks/${encodeURIComponent(campaignId)}/reply-subsequence`;
    const { data, error, mutate } = useSWR<SettingsResponse>(path, request);
    const [draft, setDraft] = useState<{ enabled: boolean; offsets: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    if (!data) return error ? <p role="alert" className="text-sm text-destructive">Could not load playbook follow-up options.</p> : null;
    const effective = draft ?? { enabled: !!data.config?.enabled, offsets: data.config?.steps.join(", ") ?? "0, 48, 120" };

    async function save() {
        setSaving(true);
        setSaveError(null);
        setMessage(null);
        try {
            const steps = effective.offsets.split(",").map(value => value.trim() ? Number(value) : Number.NaN);
            if (steps.some(value => !Number.isInteger(value))) throw new Error("Enter whole hours separated by commas.");
            await request(path, { enabled: effective.enabled, steps });
            await mutate();
            setDraft(null);
            setMessage("Playbook follow-up settings saved.");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save follow-up settings.");
        } finally {
            setSaving(false);
        }
    }

    return <GlassCard className="space-y-3 p-4">
        <h3 className="font-semibold">Reply follow-up plans</h3>
        <p className="text-sm text-muted-foreground">Choose when each approved follow-up is due, in hours from the first reply.</p>
        {!data.masterEnabled && <p className="text-sm text-muted-foreground">Enable follow-up plans in <Link href="/settings/replies" className="text-primary underline">Replies &amp; Follow-ups</Link> first.</p>}
        <fieldset disabled={!data.canEdit || saving} className="space-y-2">
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={effective.enabled} disabled={!data.masterEnabled && !effective.enabled}
                onChange={e => { setMessage(null); setDraft({ ...effective, enabled: e.target.checked }); }} />Enable for this playbook</label>
            <label className="block text-sm">Hours after the reply
                <input className="ml-2 rounded border border-border bg-background px-2 py-1" value={effective.offsets}
                    onChange={e => { setMessage(null); setDraft({ ...effective, offsets: e.target.value }); }} />
            </label>
            {data.canEdit && <Button variant="outline" size="sm" disabled={!draft || saving} onClick={() => void save()}>Save playbook settings</Button>}
        </fieldset>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
    </GlassCard>;
}
