"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, Loader2, Mail } from "lucide-react";

export interface SelectableLead {
    id: string;
    fullName: string | null;
    email: string | null;
    company: string | null;
    status: string | null;
    intentScore: number | null;
}

type Campaign = { id: string; name: string };

function intentTier(intentScore?: number | null) {
    const score = intentScore ?? 0;
    if (score >= 0.7) return { label: "HOT", className: "text-destructive border-destructive/25 bg-destructive/5" };
    if (score >= 0.4) return { label: "WARM", className: "text-warning border-warning/25 bg-warning/5" };
    return { label: "COLD", className: "text-primary border-primary/25 bg-primary/5" };
}

function displayLeadStatus(status?: string | null) {
    if (!status) return "NEW STATE";
    const labels: Record<string, string> = {
        NEW: "NEW LEAD",
        enriched: "ENRICHED",
        ENRICHED: "ENRICHED",
        CONTACTED: "CONTACTED",
        CONNECTED: "ENGAGED",
        REPLIED: "POS REPLY",
        CONVERTED: "CONVERTED",
        LOST: "LOST",
        STOPPED: "STOPPED",
    };
    return labels[status] ?? status.toUpperCase();
}

export default function LeadsSelectionGrid({ leads }: { leads: SelectableLead[] }) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignId, setCampaignId] = useState("");
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (selected.size === 0 || campaigns.length > 0) return;
        fetch("/api/campaigns")
            .then((res) => res.json())
            .then((data) => setCampaigns(Array.isArray(data) ? data.map((c: any) => ({ id: c.id, name: c.name })) : []))
            .catch(() => setCampaigns([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected.size]);

    const selectedCount = selected.size;

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function handleAssign() {
        if (!campaignId || selectedCount === 0) return;
        setAssigning(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadIds: Array.from(selected) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add leads to campaign");
            toast.success(`Added ${selectedCount} lead${selectedCount === 1 ? "" : "s"} to campaign`);
            setSelected(new Set());
            setCampaignId("");
        } catch (err: any) {
            toast.error(err.message || "Failed to add leads to campaign");
        } finally {
            setAssigning(false);
        }
    }

    const grid = useMemo(
        () => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leads.map((lead, index) => {
                    const tier = intentTier(lead.intentScore);
                    const isSelected = selected.has(lead.id);
                    return (
                        <div
                            key={lead.id}
                            id={`lead-card-${index}`}
                            className={`relative flex flex-col justify-between p-6 rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200 group min-h-48 ${
                                isSelected ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/50"
                            }`}
                        >
                            <label className="absolute top-4 left-4 z-10 flex items-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggle(lead.id)}
                                    className="h-4 w-4 rounded border-input"
                                    aria-label={`Select ${lead.fullName || lead.email || "lead"}`}
                                />
                            </label>
                            <Link href={`/leads/${lead.id}`} className="contents">
                                <div>
                                    <div className="flex justify-end items-start gap-2 mb-4">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider bg-muted text-muted-foreground border-border">
                                                {displayLeadStatus(lead.status)}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider ${tier.className}`}>
                                                {tier.label} · {Math.round((lead.intentScore ?? 0) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 pl-6">
                                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                            {lead.fullName || "Unnamed Lead"}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="truncate">{lead.company || "Independent"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-border">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
                                        <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                        <span className="truncate">{lead.email}</span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>
        ),
        [leads, selected]
    );

    return (
        <div className="space-y-4 pb-20">
            {grid}
            {selectedCount > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border bg-card text-card-foreground shadow-lg px-5 py-3">
                    <span className="text-xs font-semibold text-foreground">{selectedCount} selected</span>
                    <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                        className="bg-background border border-input rounded-md px-2 py-1.5 text-xs text-foreground outline-none"
                    >
                        <option value="">Select a campaign...</option>
                        {campaigns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={!campaignId || assigning}
                        className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 px-3 text-xs font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Add to campaign
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}
