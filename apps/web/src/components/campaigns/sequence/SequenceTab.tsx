"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import AIPanel from "./AIPanel";
import SequenceCanvas, { SequenceStepItem } from "./SequenceCanvas";
import { SequenceMailbox } from "./SenderScheduleNode";

interface SequenceStepFromApi {
    id: string;
    stepType: string;
    stepOrder: number;
}

export default function SequenceTab({ campaignId }: { campaignId: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [steps, setSteps] = useState<SequenceStepItem[]>([]);
    const [senderMailboxIds, setSenderMailboxIds] = useState<string[]>([]);
    const [timezone, setTimezone] = useState("UTC");
    const [mailboxes, setMailboxes] = useState<SequenceMailbox[]>([]);
    const [linkedinLocked, setLinkedinLocked] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const [sequenceRes, mailboxesRes] = await Promise.all([
                    fetch(getBrowserApiUrl(`/campaigns/${campaignId}/sequence`), { cache: "no-store" }),
                    fetch(getBrowserApiUrl("/integrations/google/mailboxes"), { cache: "no-store" }),
                ]);

                if (!sequenceRes.ok) throw new Error("Failed to load sequence");
                const sequenceData = await sequenceRes.json();
                const mailboxesData = mailboxesRes.ok ? await mailboxesRes.json() : [];

                if (cancelled) return;

                const loadedSteps: SequenceStepFromApi[] = sequenceData.steps || [];
                setSteps(loadedSteps.map((s) => ({ id: s.id, stepType: s.stepType })));
                setSenderMailboxIds(sequenceData.sequence?.senderMailboxIds || []);
                setTimezone(sequenceData.sequence?.timezone || "UTC");
                setLinkedinLocked(Boolean(sequenceData.linkedinLocked));
                setMailboxes(Array.isArray(mailboxesData) ? mailboxesData : []);
            } catch (error: any) {
                if (!cancelled) toast.error(error?.message || "Failed to load sequence");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    const handleSenderScheduleChange = useCallback((update: { senderMailboxIds?: string[]; timezone?: string }) => {
        if (update.senderMailboxIds !== undefined) setSenderMailboxIds(update.senderMailboxIds);
        if (update.timezone !== undefined) setTimezone(update.timezone);
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiUrl(`/campaigns/${campaignId}/sequence`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    steps: steps.map((s, index) => ({ id: s.id, stepType: s.stepType, stepOrder: index })),
                    senderMailboxIds,
                    timezone,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to save sequence");
                return;
            }
            const savedSteps: SequenceStepFromApi[] = data.steps || [];
            setSteps(savedSteps.map((s) => ({ id: s.id, stepType: s.stepType })));
            toast.success("Sequence saved");
        } catch (error: any) {
            toast.error(error?.message || "Failed to save sequence");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex h-[720px] gap-4">
            <AIPanel />

            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border">
                <div className="flex items-center justify-end border-b border-border bg-card p-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? "Saving..." : "Save sequence"}
                    </button>
                </div>
                <div className="flex-1">
                    <SequenceCanvas
                        steps={steps}
                        onStepsChange={setSteps}
                        senderMailboxIds={senderMailboxIds}
                        mailboxes={mailboxes}
                        timezone={timezone}
                        onSenderScheduleChange={handleSenderScheduleChange}
                        linkedinLocked={linkedinLocked}
                    />
                </div>
            </div>
        </div>
    );
}
