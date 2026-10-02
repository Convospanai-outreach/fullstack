"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { STAGE_META, STAGES, STATUS_LABEL, type FunnelStage } from "@/lib/contentCalendar";
import { PLAN_STATUS, type PlanSummary } from "./LaunchPlans";

// One launch plan: everything the wizard drafted, in one place, and one button to delete it all.

type PlanPost = {
    id: string;
    body: string;
    channelCaptions: { INSTAGRAM?: string; LINKEDIN?: string } | null;
    visualBrief: string | null;
    funnelStage: FunnelStage;
    status: keyof typeof STATUS_LABEL;
    scheduledAt: string | null;
    targets: { status: string; socialAccount: { id: string; platform: string; handle: string | null } }[];
};
export type PlanDetail = Omit<PlanSummary, "_count"> & {
    bookingUrl: string | null;
    icpCreated: boolean;
    product: { id: string; name: string } | null;
    icp: { id: string; name: string } | null;
    contentPosts: PlanPost[];
};

class NotFound extends Error {}
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new NotFound();
    if (!res.ok) throw new Error(`plan ${res.status}`);
    return (await res.json()).run;
};

const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No time set";

export function LaunchPlanReview({ id }: { id: string }) {
    const router = useRouter();
    const url = getBrowserApiUrl(`/content/playbooks/${encodeURIComponent(id)}`);
    const { data, error, mutate } = useSWR<PlanDetail>(url, fetcher, {
        // Poll while the posts are being written.
        refreshInterval: (latest) => (latest?.status === "GENERATING" && !latest.stale ? 4000 : 0),
    });
    const [busy, setBusy] = useState<string | null>(null);

    if (error instanceof NotFound) return <p className="text-sm text-muted-foreground">This plan doesn&apos;t exist, or the creator funnel isn&apos;t on for this workspace.</p>;
    if (error) return <p className="text-sm text-destructive">Couldn&apos;t load the plan.</p>;
    if (!data) return <p className="text-sm text-muted-foreground">Loading plan...</p>;

    const retry = async () => {
        setBusy("retry");
        try {
            const res = await fetch(`${url}/retry`, { method: "POST" });
            const body = await res.json().catch(() => null);
            if (!res.ok) toast.error(typeof body?.error === "string" ? body.error : "Couldn't start again.");
            await mutate();
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        if (!window.confirm("Delete this plan and all of its draft posts? Posts that are already live stay.")) return;
        setBusy("delete");
        try {
            const res = await fetch(url, { method: "DELETE" });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(typeof body?.error === "string" ? body.error : "Couldn't delete the plan.");
                return;
            }
            toast.success(body.kept ? `Deleted ${body.deleted} drafts. ${body.kept} live post${body.kept === 1 ? "" : "s"} kept.` : `Deleted ${body.deleted} drafts.`);
            router.push("/content/plans");
        } finally {
            setBusy(null);
        }
    };

    const counts = STAGES.map((s) => [s, data.contentPosts.filter((p) => p.funnelStage === s).length] as const).filter(([, n]) => n > 0);
    const canRetry = data.status === "FAILED" || data.stale;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4">
                <div className="space-y-1 text-sm">
                    <div className="font-semibold text-foreground">{data.name}</div>
                    <div className="text-muted-foreground">
                        {data.stale ? "Stopped before it finished." : PLAN_STATUS[data.status]}
                        {data.product && <> · Offer: {data.product.name}</>}
                        {data.bookingUrl && <> · Offer: a call (<a href={data.bookingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">booking link</a>)</>}
                        {data.icp && <> · Audience: {data.icp.name}</>}
                    </div>
                    {counts.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {counts.map(([s, n]) => (
                                <span key={s} className={`rounded border px-1.5 text-xs ${STAGE_META[s].className}`}>{STAGE_META[s].label}: {n}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {canRetry && (
                        <button type="button" onClick={retry} disabled={busy !== null} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
                            {busy === "retry" ? "Starting..." : "Try again"}
                        </button>
                    )}
                    <button type="button" onClick={remove} disabled={busy !== null} className="h-9 rounded-md border border-destructive/30 px-3 text-sm text-destructive disabled:opacity-50">
                        {busy === "delete" ? "Deleting..." : "Delete plan and drafts"}
                    </button>
                </div>
            </div>

            {data.status === "GENERATING" && !data.stale && <p className="text-sm text-muted-foreground">Writing your posts. This takes a minute or two; the page updates by itself.</p>}
            {data.status === "FAILED" && <p className="text-sm text-destructive">{data.error || "Something went wrong."}</p>}

            {data.contentPosts.length > 0 && (
                <>
                    <p className="text-sm text-muted-foreground">
                        These are drafts. Edit any of them in the <Link href="/content/calendar" className="text-primary hover:underline">content calendar</Link>, add
                        an image, and send it for approval. Nothing is posted until it&apos;s approved.
                    </p>
                    <ul className="space-y-3">
                        {data.contentPosts.map((post) => (
                            <li key={post.id} className="space-y-3 rounded-lg border border-border p-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className={`rounded border px-1.5 ${STAGE_META[post.funnelStage].className}`}>{STAGE_META[post.funnelStage].label}</span>
                                    <span>{when(post.scheduledAt)}</span>
                                    <span>· {STATUS_LABEL[post.status]}</span>
                                    {post.targets.map((t) => <span key={t.socialAccount.id}>· {t.socialAccount.handle || t.socialAccount.platform}</span>)}
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {[
                                        ["Facebook", post.body],
                                        ["Instagram", post.channelCaptions?.INSTAGRAM || post.body],
                                        ["LinkedIn", post.channelCaptions?.LINKEDIN || post.body],
                                    ].map(([label, text]) => (
                                        <div key={label} className="space-y-1">
                                            <div className="text-xs font-medium text-muted-foreground">{label}</div>
                                            <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
                                        </div>
                                    ))}
                                </div>
                                {post.visualBrief && <p className="text-xs text-muted-foreground">Suggested visual: {post.visualBrief}</p>}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {data.icpCreated && data.icp && <p className="text-xs text-muted-foreground">The audience &quot;{data.icp.name}&quot; was saved in the ICP builder and stays if you delete this plan.</p>}
        </div>
    );
}
