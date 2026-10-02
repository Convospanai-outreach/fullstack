"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { STAGE_META, STAGES, stageMix, type CalendarPost, type FunnelStage } from "@/lib/contentCalendar";

const MIX_URL = getBrowserApiUrl("/content/stage-mix");
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`stage-mix ${res.status}`);
    return res.json();
};

// How the posts on screen split across funnel stages, against the team's target mix.
export function StageMixMeter({ posts }: { posts: CalendarPost[] }) {
    const { data, mutate } = useSWR<{ target: Record<FunnelStage, number> }>(MIX_URL, fetcher);
    const [editing, setEditing] = useState<Record<FunnelStage, string> | null>(null);
    const [saving, setSaving] = useState(false);
    const { total, pct } = stageMix(posts);
    const target = data?.target;

    const save = async () => {
        if (!editing) return;
        const mix = Object.fromEntries(STAGES.map((s) => [s, Number(editing[s])])) as Record<FunnelStage, number>;
        if (STAGES.some((s) => !Number.isInteger(mix[s]) || mix[s] < 0) || STAGES.reduce((sum, s) => sum + mix[s], 0) !== 100) {
            toast.error("Use whole numbers that add up to 100.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(MIX_URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mix) });
            if (res.status === 403) throw new Error("Only workspace admins can change the target.");
            if (!res.ok) throw new Error("Couldn't save the target. Try again.");
            await mutate(await res.json(), { revalidate: false });
            setEditing(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save the target.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                    Stage mix <span className="font-normal text-muted-foreground">· {total} post{total === 1 ? "" : "s"} in view</span>
                </p>
                {target && !editing && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditing(Object.fromEntries(STAGES.map((s) => [s, String(target[s])])) as Record<FunnelStage, string>)}>
                        Change target
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {STAGES.map((stage) => (
                    <div key={stage} className="space-y-1">
                        <div className="flex items-baseline justify-between text-xs">
                            <span className="font-medium text-foreground" title={STAGE_META[stage].label}>{stage}</span>
                            <span className="text-muted-foreground">
                                {pct[stage]}%{target ? ` of ${target[stage]}%` : ""}
                            </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted">
                            <div className={`h-2 rounded-full ${STAGE_META[stage].bar}`} style={{ width: `${pct[stage]}%` }} />
                            {target && <div className="absolute -top-0.5 h-3 w-0.5 bg-foreground/70" style={{ left: `calc(${target[stage]}% - 1px)` }} aria-hidden />}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{STAGE_META[stage].label}</p>
                        {editing && (
                            <input
                                type="number"
                                min={0}
                                max={100}
                                aria-label={`${stage} target percent`}
                                value={editing[stage]}
                                onChange={(e) => setEditing({ ...editing, [stage]: e.target.value })}
                                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                            />
                        )}
                    </div>
                ))}
            </div>

            {editing && (
                <div className="flex justify-end gap-2">
                    <button type="button" className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => setEditing(null)}>
                        Cancel
                    </button>
                    <button type="button" disabled={saving} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={save}>
                        {saving ? "Saving..." : "Save target"}
                    </button>
                </div>
            )}
        </div>
    );
}
