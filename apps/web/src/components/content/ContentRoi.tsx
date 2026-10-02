"use client";

import { useState } from "react";
import useSWR from "swr";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { STAGE_META, type FunnelStage } from "@/lib/contentCalendar";

// Content ROI (apps/api contentRoi.ts): what each published post brought in.

type Money = { currency: string; amount: number };

export type ContentRoiReport = {
    days: number;
    mainCurrency: string | null;
    posts: {
        id: string;
        excerpt: string;
        funnelStage: FunnelStage;
        channels: { platform: string; handle: string | null }[];
        publishedAt: string | null;
        visits: number;
        optIns: number;
        purchases: number;
        revenue: Money[];
    }[];
    stages: { from: FunnelStage; to: FunnelStage; reached: number; converted: number; rate: number | null }[];
    unattributed: { purchases: number; revenue: Money[] };
    totalRevenue: Money[];
};

const WINDOWS = [7, 30, 90] as const;

// 404 = the creator funnel isn't on for this team: show nothing.
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`content roi ${res.status}`);
    return res.json();
};

// Amounts are in the smallest unit (paise / cents), like the payments page.
const money = (list: Money[]) =>
    list.length ? list.map((m) => `${(m.amount / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${m.currency}`).join(" + ") : "—";
const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

export function ContentRoi() {
    const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
    const { data, error } = useSWR<ContentRoiReport | null>(getBrowserApiUrl(`/content/roi?days=${days}`), fetcher);

    if (error) return <p className="text-sm text-destructive">Couldn&apos;t load the report.</p>;
    if (data === null) return <p className="text-sm text-muted-foreground">Content ROI is part of the creator funnel, which isn&apos;t on for this workspace.</p>;
    if (!data) return <p className="text-sm text-muted-foreground">Loading report...</p>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Visits and opt-ins count landing page sessions and sign-ups from each post&apos;s links in the last {data.days} days.
                    Purchases count paid checkouts started in that time, credited to the post in the order&apos;s link, or else to the post
                    that first brought the buyer in.
                </p>
                <div className="flex gap-1" role="group" aria-label="Time window">
                    {WINDOWS.map((w) => (
                        <button key={w} type="button" onClick={() => setDays(w)} aria-pressed={days === w}
                            className={`rounded-md border px-3 py-1 text-sm ${days === w ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"}`}>
                            {w} days
                        </button>
                    ))}
                </div>
            </div>

            <section className="rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Funnel stage conversion</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                    {data.stages.map((s) => (
                        <div key={s.from} className="rounded-md border border-border p-3">
                            <div className="text-xs text-muted-foreground">{STAGE_META[s.from].label} → {STAGE_META[s.to].label}</div>
                            <div className="text-xl font-semibold text-foreground">{percent(s.rate)}</div>
                            <div className="text-xs text-muted-foreground">{s.converted} of {s.reached} leads</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                    <h3 className="text-sm font-semibold text-foreground">Posts, top earners first</h3>
                    <span className="text-xs text-muted-foreground">Total revenue: {money(data.totalRevenue)}</span>
                </div>
                {data.posts.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No published posts yet. Posts appear here once they&apos;re live.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-muted-foreground">
                                <tr>
                                    <th className="p-3 font-medium">Post</th>
                                    <th className="p-3 font-medium text-right">Visits</th>
                                    <th className="p-3 font-medium text-right">Opt-ins</th>
                                    <th className="p-3 font-medium text-right">Purchases</th>
                                    <th className="p-3 font-medium text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.posts.map((p) => (
                                    <tr key={p.id} className="border-t border-border">
                                        <td className="p-3">
                                            <div className="text-foreground">{p.excerpt || "(no text)"}</div>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span className={`rounded border px-1.5 ${STAGE_META[p.funnelStage].className}`}>{STAGE_META[p.funnelStage].label}</span>
                                                {p.channels.map((c, i) => <span key={i}>{c.handle || c.platform}</span>)}
                                                {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString()}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right tabular-nums">{p.visits}</td>
                                        <td className="p-3 text-right tabular-nums">{p.optIns}</td>
                                        <td className="p-3 text-right tabular-nums">{p.purchases}</td>
                                        <td className="p-3 text-right tabular-nums">{money(p.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {data.unattributed.purchases > 0 && (
                    <p className="border-t border-border p-4 text-xs text-muted-foreground">
                        {data.unattributed.purchases} purchase{data.unattributed.purchases === 1 ? "" : "s"} ({money(data.unattributed.revenue)}) couldn&apos;t be
                        traced to a post, for example a buyer who paid with a different email than they signed up with.
                    </p>
                )}
            </section>
        </div>
    );
}
