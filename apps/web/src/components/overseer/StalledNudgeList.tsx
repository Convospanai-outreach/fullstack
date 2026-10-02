"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Lightbulb, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

// Overseer stalled-funnel nudges (open only) with their Dismiss / Mark Acted actions.
// Shared by /approvals and the Action Inbox's Stalled tab.

export interface OverseerNudge {
    id: string;
    stage: string;
    stallDays: number;
    nudgeType: string;
    suggestion: string;
    createdAt: string;
}

function formatNudgeType(nudgeType: string) {
    return nudgeType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function StalledNudgeList({ onCountChange, header }: {
    onCountChange?: (count: number) => void;
    // Rendered above the list only when there is at least one nudge.
    header?: ReactNode;
}) {
    const [nudges, setNudges] = useState<OverseerNudge[] | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        const fetchNudges = async () => {
            try {
                const res = await fetch("/api/overseer/nudges");
                const data = await res.json();
                setNudges(data.nudges ?? []);
            } catch (err) {
                console.error("Failed to load overseer nudges", err);
                setNudges([]);
            }
        };
        fetchNudges();
    }, []);

    useEffect(() => {
        if (nudges) onCountChange?.(nudges.length);
    }, [nudges, onCountChange]);

    const handleNudgeAction = async (id: string, action: "ACTED" | "DISMISSED") => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/overseer/nudges/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            if (!res.ok) throw new Error("Action failed");
            setNudges(current => (current ?? []).filter(n => n.id !== id));
        } catch (err) {
            toast.error("Failed to update nudge");
        } finally {
            setProcessing(null);
        }
    };

    if (!nudges || nudges.length === 0) return null;

    return (
        <div className="space-y-4">
            {header}
            <div className="grid gap-4">
                {nudges.map((nudge) => (
                    <GlassCard key={nudge.id} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/30">
                                <Lightbulb className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-foreground text-lg">{formatNudgeType(nudge.nudgeType)}</h4>
                                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs border border-border">
                                        {nudge.stage} · stalled {nudge.stallDays.toFixed(1)}d
                                    </span>
                                </div>
                                <p className="text-muted-foreground text-sm">{nudge.suggestion}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button
                                disabled={!!processing}
                                onClick={() => handleNudgeAction(nudge.id, "DISMISSED")}
                                className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <X className="w-4 h-4" /> Dismiss
                            </button>
                            <button
                                disabled={!!processing}
                                onClick={() => handleNudgeAction(nudge.id, "ACTED")}
                                className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Mark Acted
                            </button>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
}
