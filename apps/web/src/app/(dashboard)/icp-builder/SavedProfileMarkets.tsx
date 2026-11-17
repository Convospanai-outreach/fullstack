"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiBase } from "@/lib/api/browserBase";

type SavedIcp = { id: string; name: string; criteria?: Record<string, unknown> | null };

const asText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "");

// Saved profiles made before Target Markets existed have none. Setting them here lets email drafts,
// drip and playbooks write for the right market. Only geographies change; the rest of the criteria is kept.
export default function SavedProfileMarkets() {
    const [icps, setIcps] = useState<SavedIcp[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        fetch(getBrowserApiBase() + "/icp-builder/list")
            .then((r) => r.json())
            .then((data) => {
                const list: SavedIcp[] = Array.isArray(data?.icps) ? data.icps : [];
                setIcps(list);
                setValues(Object.fromEntries(list.map((i) => [i.id, asText(i.criteria?.["geographies"] ?? i.criteria?.["geography"])])));
            })
            .catch(() => undefined);
    }, []);

    async function save(icp: SavedIcp) {
        setSavingId(icp.id);
        try {
            const geographies = (values[icp.id] ?? "").split(/[,;]/).map((g) => g.trim()).filter(Boolean);
            const res = await fetch(getBrowserApiBase() + `/icp-builder/${encodeURIComponent(icp.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ criteria: { ...(icp.criteria ?? {}), geographies } }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok === false) throw new Error(data?.error || "Failed to save target markets");
            setIcps((list) => list.map((i) => (i.id === icp.id ? { ...i, criteria: { ...(i.criteria ?? {}), geographies } } : i)));
            toast.success("Target markets saved");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save target markets");
        } finally {
            setSavingId(null);
        }
    }

    if (!icps.length) return null;
    return (
        <GlassCard className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Your saved profiles</h2>
            <p className="text-sm text-muted-foreground">Set target markets so emails, drips and playbooks use the right spelling and tone.</p>
            {icps.map((icp) => (
                <div key={icp.id} className="flex items-center gap-2">
                    <span className="w-48 shrink-0 truncate text-sm">{icp.name}</span>
                    <Input
                        value={values[icp.id] ?? ""}
                        onChange={(e) => setValues({ ...values, [icp.id]: e.target.value })}
                        placeholder="e.g. India, UAE, United Kingdom"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => save(icp)} disabled={savingId === icp.id}>
                        {savingId === icp.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Save
                    </Button>
                </div>
            ))}
        </GlassCard>
    );
}
