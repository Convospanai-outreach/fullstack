"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { PostComposer } from "@/components/content/PostComposer";
import { StageMixMeter } from "@/components/content/StageMixMeter";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import {
    dayKey,
    isEditable,
    moveToDay,
    shiftAnchor,
    STAGE_META,
    STAGES,
    startOfDay,
    STATUS_LABEL,
    viewRange,
    visibleDays,
    type CalendarAccount,
    type CalendarPost,
    type CalendarView,
    type FunnelStage,
} from "@/lib/contentCalendar";

const POSTS_URL = getBrowserApiUrl("/content/posts");
const ACCOUNTS_URL = getBrowserApiUrl("/social/accounts");
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

class NotEnabledError extends Error {}
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new NotEnabledError();
    if (!res.ok) throw new Error(`content ${res.status}`);
    return res.json();
};

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Creator funnel content calendar: plan posts per funnel stage, drag to reschedule, and send
// them for approval. Publishing (phase 3b) only ever picks up approved posts.
export default function ContentCalendarPage() {
    const [view, setView] = useState<CalendarView>("month");
    const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
    const [stageFilter, setStageFilter] = useState<FunnelStage | "">("");
    const [statusFilter, setStatusFilter] = useState("");
    const [accountFilter, setAccountFilter] = useState("");
    const [composer, setComposer] = useState<{ post: CalendarPost | null; when: Date | null } | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);

    const { from, to } = viewRange(view, anchor);
    const listUrl = `${POSTS_URL}?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    const { data, error, mutate } = useSWR<{ posts: CalendarPost[]; unscheduled: CalendarPost[] }>(listUrl, fetcher);
    const { data: accountData } = useSWR<{ accounts: CalendarAccount[] }>(ACCOUNTS_URL, fetcher);
    const accounts = useMemo(() => accountData?.accounts ?? [], [accountData]);

    const matches = (p: CalendarPost) =>
        (!stageFilter || p.funnelStage === stageFilter) &&
        (!statusFilter || p.status === statusFilter) &&
        (!accountFilter || p.targets.some((t) => t.socialAccount.id === accountFilter));

    const byDay = useMemo(() => {
        const map = new Map<string, CalendarPost[]>();
        for (const post of data?.posts ?? []) {
            if (!post.scheduledAt || !matches(post)) continue;
            const key = dayKey(new Date(post.scheduledAt));
            map.set(key, [...(map.get(key) ?? []), post]);
        }
        return map;
    }, [data, stageFilter, statusFilter, accountFilter]);

    const allPosts = [...(data?.posts ?? []), ...(data?.unscheduled ?? [])];
    const findPost = (id: string) => allPosts.find((p) => p.id === id);

    const reschedule = async (postId: string, day: Date) => {
        const post = findPost(postId);
        if (!post || !isEditable(post)) return;
        const base = post.scheduledAt ? new Date(post.scheduledAt) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
        const at = moveToDay(base, day);
        if (post.scheduledAt && at.getTime() === new Date(post.scheduledAt).getTime()) return;
        const res = await fetch(`${POSTS_URL}/${encodeURIComponent(postId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledAt: at.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            toast.error(body?.error || "Couldn't move the post.");
        }
        await mutate();
    };

    const openNew = (day: Date) => {
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
        setComposer({ post: null, when: when > new Date() ? when : null });
    };

    if (error instanceof NotEnabledError) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Content calendar" subtitle="Plan posts for each stage of your funnel." />
                <GlassCard className="p-6 text-sm text-muted-foreground">
                    The content calendar isn&apos;t on for this workspace. An admin can turn on Creator funnel in{" "}
                    <Link href="/settings/features" className="text-primary hover:underline">Settings &gt; Features</Link>.
                </GlassCard>
            </div>
        );
    }

    const days = visibleDays(view, anchor);
    const todayKey = dayKey(new Date());
    const title = view === "month"
        ? anchor.toLocaleDateString([], { month: "long", year: "numeric" })
        : `Week of ${days[0].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;
    const unscheduled = (data?.unscheduled ?? []).filter(matches);

    const chip = (post: CalendarPost) => (
        <button
            key={post.id}
            type="button"
            draggable={isEditable(post)}
            onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", post.id);
                setDragging(post.id);
            }}
            onDragEnd={() => setDragging(null)}
            onClick={(e) => {
                e.stopPropagation();
                setComposer({ post, when: null });
            }}
            title={`${STAGE_META[post.funnelStage].label} · ${STATUS_LABEL[post.status]}`}
            className={`w-full rounded border px-1.5 py-1 text-left text-[11px] leading-tight ${STAGE_META[post.funnelStage].className} ${dragging === post.id ? "opacity-50" : ""}`}
        >
            <span className="flex items-center justify-between gap-1 font-semibold">
                <span>{post.scheduledAt ? timeOf(post.scheduledAt) : post.funnelStage}</span>
                <span className="font-normal opacity-80">{post.status === "DRAFT" ? "Draft" : STATUS_LABEL[post.status]}</span>
            </span>
            <span className={`block text-foreground/80 ${view === "week" ? "line-clamp-4" : "truncate"}`}>{post.body || "(image only)"}</span>
        </button>
    );

    const dropProps = (day: Date) => ({
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            setDragging(null);
            if (id) void reschedule(id, day);
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <SectionHeader title="Content calendar" subtitle="Plan posts for each stage of your funnel. Nothing is posted until it's approved." />
                <button
                    type="button"
                    onClick={() => setComposer({ post: null, when: null })}
                    className="inline-flex h-9 items-center gap-1.5 self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                    <Plus className="h-4 w-4" /> New post
                </button>
            </div>

            {accountData && accounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Connect an account first: <Link href="/settings/social" className="text-primary hover:underline">Settings &gt; Social accounts</Link>.
                </p>
            )}

            <StageMixMeter posts={(data?.posts ?? []).filter(matches)} />

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-border" role="group" aria-label="View">
                    {(["month", "week"] as const).map((v) => (
                        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 text-sm capitalize ${view === v ? "bg-muted font-medium" : "text-muted-foreground"}`}>
                            {v}
                        </button>
                    ))}
                </div>
                <button type="button" aria-label="Previous" onClick={() => setAnchor(shiftAnchor(view, anchor, -1))} className="h-8 rounded-md border border-border px-2"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setAnchor(startOfDay(new Date()))} className="h-8 rounded-md border border-border px-3 text-sm">Today</button>
                <button type="button" aria-label="Next" onClick={() => setAnchor(shiftAnchor(view, anchor, 1))} className="h-8 rounded-md border border-border px-2"><ChevronRight className="h-4 w-4" /></button>
                <h2 className="ml-1 text-base font-semibold text-foreground">{title}</h2>

                <div className="flex flex-wrap gap-2 sm:ml-auto">
                    <select aria-label="Stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value as FunnelStage | "")} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
                        <option value="">All stages</option>
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
                        <option value="">All statuses</option>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select aria-label="Account" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
                        <option value="">All accounts</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.handle || a.platform}</option>)}
                    </select>
                </div>
            </div>

            {error && <p className="text-sm text-destructive">Couldn&apos;t load the calendar. Reload to try again.</p>}

            <div className="overflow-x-auto">
                <div className="grid min-w-[720px] grid-cols-7 rounded-lg border border-border">
                    {WEEKDAYS.map((d) => (
                        <div key={d} className="border-b border-border px-2 py-1.5 text-xs font-medium text-muted-foreground">{d}</div>
                    ))}
                    {days.map((day) => {
                        const key = dayKey(day);
                        const inMonth = view === "week" || day.getMonth() === anchor.getMonth();
                        const posts = byDay.get(key) ?? [];
                        return (
                            <div
                                key={key}
                                {...dropProps(day)}
                                onClick={() => openNew(day)}
                                className={`${view === "week" ? "min-h-[320px]" : "min-h-[110px]"} cursor-pointer space-y-1 border-b border-r border-border p-1.5 hover:bg-muted/40 ${inMonth ? "" : "bg-muted/20"}`}
                            >
                                <div className={`text-xs ${key === todayKey ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                                    {day.getDate()}
                                </div>
                                {posts.map(chip)}
                            </div>
                        );
                    })}
                </div>
            </div>

            {unscheduled.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">No time yet <span className="font-normal text-muted-foreground">· drag onto a day to schedule for 9:00</span></p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{unscheduled.map(chip)}</div>
                </div>
            )}

            <PostComposer
                open={composer !== null}
                onClose={() => setComposer(null)}
                post={composer?.post ?? null}
                defaultWhen={composer?.when ?? null}
                accounts={accounts}
                onChanged={() => void mutate()}
            />
        </div>
    );
}
