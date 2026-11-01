"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { InstantConfirmationSequence, InstantConfirmationSetting } from "@/modules/landing-agent/types";

// The page's optional message right after a form lead is stored (apps/api instantConfirmation.ts).
// The API returns only the sequences that can send, and the picker lists exactly those.
export default function InstantConfirmationPanel({
    initial,
    onLoadSequences,
    onSave,
}: {
    initial?: InstantConfirmationSetting | null;
    onLoadSequences: () => Promise<InstantConfirmationSequence[]>;
    onSave: (setting: InstantConfirmationSetting) => Promise<string>;
}) {
    const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
    const [sequenceId, setSequenceId] = useState(initial?.sequenceId ?? "");
    const [sequences, setSequences] = useState<InstantConfirmationSequence[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        onLoadSequences()
            .then((list) => {
                if (!cancelled) setSequences(list);
            })
            .catch(() => {
                if (!cancelled) {
                    setSequences([]);
                    setLoadFailed(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [onLoadSequences]);

    const noEligibleSequence = sequences !== null && sequences.length === 0;
    const chosen = sequences?.find((sequence) => sequence.id === sequenceId);

    return (
        <GlassCard className="p-6 space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Instant confirmation</h2>
                <p className="text-sm text-muted-foreground">
                    Sent once right after someone submits the form. Not sent if they decline the consent box, are on your
                    do-not-contact list, or already receive another automatic sequence. If you pick a draft sequence it starts
                    on the first sign-up.
                </p>
                <p className="text-sm text-muted-foreground">
                    Edit the wording in <Link href="/campaigns" className="underline">Campaigns</Link>, on the sequence tab.
                </p>
            </div>
            <form
                className="space-y-4"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setSaving(true);
                    setMessage(null);
                    try {
                        setMessage({ ok: true, text: await onSave({ enabled, sequenceId }) });
                    } catch (err: any) {
                        setMessage({ ok: false, text: err?.message || "Could not save instant confirmation" });
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                        id="instant-confirmation-enabled"
                        type="checkbox"
                        role="switch"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    Send a confirmation message
                </label>

                {enabled && sequences === null ? <p className="text-sm text-muted-foreground">Loading sequences...</p> : null}
                {enabled && loadFailed ? <p className="text-sm text-destructive">Could not load your sequences. Reload the page to try again.</p> : null}

                {enabled && noEligibleSequence && !loadFailed ? (
                    <p className="text-sm text-muted-foreground">
                        This team has no sequence that can send an instant confirmation. A sequence qualifies when it has
                        exactly one active step, and that step is an email (with a sender mailbox set) or a WhatsApp message
                        using an approved WhatsApp template.
                    </p>
                ) : null}

                {enabled && sequences && sequences.length > 0 ? (
                    <div className="space-y-1">
                        <label htmlFor="instant-confirmation-sequence" className="text-sm text-foreground">
                            Sequence to send
                        </label>
                        <select
                            id="instant-confirmation-sequence"
                            value={sequenceId}
                            onChange={(e) => setSequenceId(e.target.value)}
                            className="w-full md:w-96 bg-background border border-input rounded-lg px-3 py-2 text-foreground"
                        >
                            <option value="">Choose a sequence</option>
                            {sequences.map((sequence) => (
                                <option key={sequence.id} value={sequence.id}>
                                    {`${sequence.name} (${sequence.channel === "email" ? "Email" : "WhatsApp"}, ${sequence.status === "DRAFT" ? "Draft" : "Active"})`}
                                </option>
                            ))}
                        </select>
                        {chosen?.campaignId ? (
                            <Link href={`/campaigns/${encodeURIComponent(chosen.campaignId)}?tab=sequence`} className="text-sm underline">
                                Open this sequence
                            </Link>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving || (enabled && !sequenceId)}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save instant confirmation"}
                    </button>
                    {message ? <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p> : null}
                </div>
            </form>
        </GlassCard>
    );
}
