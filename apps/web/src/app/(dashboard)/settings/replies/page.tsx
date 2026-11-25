"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type ReplySettings = {
    scheduledReplies: boolean;
    delayChoices: (1 | 24)[];
    followUpPlans: boolean;
    maxSteps: number;
    minSpacingHours: number;
    approvalHours: number;
    autoPause: { confidence: number; holdHours: number };
    notifications: boolean;
};

type SendingWindow = { enabled: boolean; days: number[]; startHour: number; endHour: number; timeZone: string };
type SettingsResponse = { settings: ReplySettings; sendWindow: SendingWindow; canEdit: boolean; invalid?: boolean };

const settingsPath = "/settings/replies";
const cooldownPath = "/settings/account-reply-cooldown";
const inputClass = "rounded border border-border bg-background px-2 py-1 text-sm";

async function request<T>(path: string, settings?: unknown): Promise<T> {
    const response = await fetch(getBrowserApiUrl(path), settings === undefined ? undefined : {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update reply settings.");
    return data;
}

export default function ReplySettingsPage() {
    const { data, error, mutate } = useSWR<SettingsResponse>(settingsPath, request);
    const { data: cooldown, error: cooldownError, mutate: refreshCooldown } = useSWR<{ hours: number; canEdit: boolean }>(cooldownPath, request);
    const [draft, setDraft] = useState<ReplySettings | null>(null);
    const [windowDraft, setWindowDraft] = useState<SendingWindow | null>(null);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const settings = draft ?? data?.settings;
    const sendWindow = windowDraft ?? data?.sendWindow;

    function patch(update: Partial<ReplySettings>) {
        if (!settings) return;
        setDraft({ ...settings, ...update });
        setStatus(null);
    }

    async function save() {
        if (!settings || !data?.canEdit) return;
        setSaving(true);
        setSaveError(null);
        setStatus(null);
        try {
            await mutate(await request(settingsPath, { ...settings, ...(windowDraft ? { sendWindow: windowDraft } : {}) }), { revalidate: false });
            setWindowDraft(null);
            setDraft(null);
            setStatus("Reply settings saved.");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save reply settings.");
        } finally {
            setSaving(false);
        }
    }

    async function saveCooldown(hours: number) {
        setSaving(true);
        setSaveError(null);
        setStatus(null);
        try {
            await request(cooldownPath, { hours });
            await refreshCooldown();
            setStatus("Account reply cooldown saved.");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save the cooldown.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-3xl space-y-5">
            <SectionHeader title="Replies & Follow-ups" subtitle="Manage scheduled replies and approved follow-up plans for your team." />
            <Link href="/inbox?tab=outbox" className="inline-block text-sm text-primary underline">Open Outbox</Link>
            {data?.invalid && <p role="alert" className="text-sm text-destructive">Saved settings are invalid; safe defaults are in use.</p>}
            {error && <p role="alert" className="text-sm text-destructive">Could not load reply settings.</p>}
            {!settings && !error && <p className="text-sm text-muted-foreground">Loading reply settings…</p>}
            {settings && <fieldset disabled={!data?.canEdit || saving} className="space-y-4">
                <GlassCard className="space-y-3 p-5">
                    <label className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.scheduledReplies} onChange={e => patch({ scheduledReplies: e.target.checked })} />Scheduled replies</label>
                    <p className="text-sm text-muted-foreground">Allow team members to schedule one-off replies. Turning this off blocks scheduled dispatch.</p>
                    <label className="flex items-center gap-2 text-sm">Allowed delays
                        <select className={inputClass} value={settings.delayChoices.join(",")} onChange={e => patch({ delayChoices: e.target.value === "1,24" ? [1, 24] : e.target.value === "1" ? [1] : [24] })}>
                            <option value="1,24">1 hour or 24 hours</option><option value="1">1 hour only</option><option value="24">24 hours only</option>
                        </select>
                    </label>
                </GlassCard>
                <GlassCard className="space-y-3 p-5">
                    <label className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.followUpPlans} onChange={e => patch({ followUpPlans: e.target.checked })} />Follow-up plans</label>
                    <p className="text-sm text-muted-foreground">Allow admins to enable plans per playbook. Each message needs a person’s approval.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm">Maximum steps <input className={inputClass} type="number" min={1} max={4} value={settings.maxSteps} onChange={e => patch({ maxSteps: Number(e.target.value) })} /></label>
                        <label className="flex items-center gap-2 text-sm">Minimum hours between steps <input className={inputClass} type="number" min={24} max={336} value={settings.minSpacingHours} onChange={e => patch({ minSpacingHours: Number(e.target.value) })} /></label>
                        <label className="flex items-center gap-2 text-sm">Approval expires after hours <input className={inputClass} type="number" min={1} max={72} value={settings.approvalHours} onChange={e => patch({ approvalHours: Number(e.target.value) })} /></label>
                        <label className="flex items-center gap-2 text-sm">Pause after hours on hold <input className={inputClass} type="number" min={1} max={24} value={settings.autoPause.holdHours} onChange={e => patch({ autoPause: { ...settings.autoPause, holdHours: Number(e.target.value) } })} /></label>
                        <label className="flex items-center gap-2 text-sm">Minimum classification confidence (%) <input className={inputClass} type="number" min={70} max={100} value={Math.round(settings.autoPause.confidence * 100)} onChange={e => patch({ autoPause: { ...settings.autoPause, confidence: Number(e.target.value) / 100 } })} /></label>
                    </div>
                    <p className="text-sm text-muted-foreground">Plans pause for new replies, opt-out language, changed threads, and unclear classifications.</p>
                </GlassCard>
                <GlassCard className="space-y-3 p-5">
                    <label className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.notifications} onChange={e => patch({ notifications: e.target.checked })} />Plan notifications</label>
                    <p className="text-sm text-muted-foreground">Notify owners when a plan is paused, held, or about to send. <Link href="/settings/notifications" className="text-primary underline">Manage notification preferences</Link>.</p>
                </GlassCard>
                {sendWindow && <GlassCard className="space-y-3 p-5">
                    <label className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={sendWindow.enabled} onChange={e => setWindowDraft({ ...sendWindow, enabled: e.target.checked })} />Allowed sending hours</label>
                    <p className="text-sm text-muted-foreground">Use the workspace sending window for follow-ups and existing outreach. The timezone is used when a recipient’s timezone is unavailable.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">Start hour <input className={inputClass} type="number" min={0} max={23} value={sendWindow.startHour} onChange={e => setWindowDraft({ ...sendWindow, startHour: Number(e.target.value) })} /></label>
                        <label className="text-sm">End hour <input className={inputClass} type="number" min={1} max={24} value={sendWindow.endHour} onChange={e => setWindowDraft({ ...sendWindow, endHour: Number(e.target.value) })} /></label>
                        <label className="text-sm">Timezone <input className={inputClass} value={sendWindow.timeZone} onChange={e => setWindowDraft({ ...sendWindow, timeZone: e.target.value })} /></label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day} className="flex gap-1 text-sm">
                            <input type="checkbox" checked={sendWindow.days.includes(index)} onChange={e => setWindowDraft({ ...sendWindow,
                                days: e.target.checked ? [...sendWindow.days, index] : sendWindow.days.filter(value => value !== index),
                            })} />{day}
                        </label>)}
                    </div>
                </GlassCard>}
                {data?.canEdit && <Button onClick={save} disabled={(!draft && !windowDraft) || saving}>Save reply settings</Button>}
            </fieldset>}
            {cooldown && <GlassCard className="space-y-3 p-5">
                <label className="block text-sm font-semibold" htmlFor="account-reply-cooldown">Account reply cooldown</label>
                <p className="text-sm text-muted-foreground">Hold outreach to other contacts at a company when someone replies.</p>
                <select id="account-reply-cooldown" className={inputClass} value={cooldown.hours} disabled={!cooldown.canEdit || saving} onChange={e => void saveCooldown(Number(e.target.value))}>
                    <option value={0}>Off</option><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option>
                </select>
            </GlassCard>}
            {cooldownError && <p role="alert" className="text-sm text-destructive">Could not load the account reply cooldown.</p>}
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
        </div>
    );
}
