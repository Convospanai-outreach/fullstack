"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import type { CalendarAccount } from "@/lib/contentCalendar";

// Creator funnel playbook wizard (apps/api playbookWizard.ts): describe the launch once and get
// 4 weeks of draft posts. Nothing is posted until each post is sent for approval and approved.

const PLANS_URL = getBrowserApiUrl("/content/playbooks");
const ACCOUNTS_URL = getBrowserApiUrl("/social/accounts");

export type PlanSummary = {
    id: string;
    name: string;
    status: "GENERATING" | "READY" | "FAILED";
    error: string | null;
    stale: boolean;
    createdAt: string;
    _count: { contentPosts: number };
};
type PlansResponse = {
    runs: PlanSummary[];
    products: { id: string; name: string; priceAmount: number; currency: string }[];
    icps: { id: string; name: string }[];
};

// 404 = the creator funnel isn't on for this team.
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`plans ${res.status}`);
    return res.json();
};

export const PLAN_STATUS: Record<PlanSummary["status"], string> = {
    GENERATING: "Writing posts...",
    READY: "Ready to review",
    FAILED: "Failed",
};

const TONES = ["Warm and encouraging", "Direct and practical", "Playful", "Expert and calm"];

function tomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LaunchPlans() {
    const router = useRouter();
    const { data, error } = useSWR<PlansResponse | null>(PLANS_URL, fetcher);
    const { data: accountData } = useSWR<{ accounts: CalendarAccount[] } | null>(ACCOUNTS_URL, fetcher);
    const accounts = (accountData?.accounts ?? []).filter((a) => a.status !== "DISCONNECTED");

    const [name, setName] = useState("");
    const [offerType, setOfferType] = useState<"product" | "booking">("product");
    const [productId, setProductId] = useState("");
    const [bookingUrl, setBookingUrl] = useState("");
    const [callDescription, setCallDescription] = useState("");
    const [audienceMode, setAudienceMode] = useState<"pick" | "describe">("pick");
    const [icpId, setIcpId] = useState("");
    const [audience, setAudience] = useState("");
    const [leadMagnet, setLeadMagnet] = useState("");
    const [tone, setTone] = useState(TONES[0]!);
    const [startDate, setStartDate] = useState(tomorrow);
    const [postsPerWeek, setPostsPerWeek] = useState(3);
    const [keyword, setKeyword] = useState("GUIDE");
    const [accountIds, setAccountIds] = useState<string[] | null>(null);
    const [busy, setBusy] = useState(false);

    // Default: post to every connected account, like a new post in the calendar.
    useEffect(() => {
        if (accountIds === null && accountData) setAccountIds(accounts.filter((a) => a.status === "CONNECTED").map((a) => a.id));
    }, [accountData]);
    useEffect(() => {
        if (!data) return;
        if (!productId && data.products[0]) setProductId(data.products[0].id);
        if (data.products.length === 0) setOfferType("booking");
        if (!icpId && data.icps[0]) setIcpId(data.icps[0].id);
        if (data.icps.length === 0) setAudienceMode("describe");
    }, [data]);

    if (error) return <p className="text-sm text-destructive">Couldn&apos;t load your launch plans.</p>;
    if (data === null) return <p className="text-sm text-muted-foreground">Launch plans are part of the creator funnel, which isn&apos;t on for this workspace.</p>;
    if (!data) return <p className="text-sm text-muted-foreground">Loading...</p>;

    const busyWriting = data.runs.some((r) => r.status === "GENERATING" && !r.stale);
    const selected = accountIds ?? [];
    // The keyword auto-reply listens on an Instagram account or Facebook Page of the plan.
    const hasTriggerAccount = accounts.some((a) => selected.includes(a.id) && (a.platform === "INSTAGRAM" || a.platform === "FACEBOOK_PAGE"));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await fetch(PLANS_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    offer: offerType === "product" ? { type: "product", productId } : { type: "booking", bookingUrl: bookingUrl.trim(), description: callDescription.trim() },
                    audience: audienceMode === "pick" ? { icpId } : { description: audience.trim() },
                    leadMagnet: leadMagnet.trim(),
                    tone: tone.trim(),
                    startDate,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    postsPerWeek,
                    accountIds: selected,
                    ...(hasTriggerAccount ? { keyword: keyword.trim() } : {}),
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(typeof body?.error === "string" ? body.error : "Check the form and try again.");
                return;
            }
            toast.success("Writing your posts. This takes a minute or two.");
            router.push(`/content/plans/${encodeURIComponent(body.run.id)}`);
        } finally {
            setBusy(false);
        }
    };

    const input = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm";
    const area = "w-full rounded-md border border-border bg-background p-3 text-sm";
    const choice = (on: boolean) => `rounded-md border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form onSubmit={submit} className="space-y-5 rounded-lg border border-border p-5">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">New launch plan</h3>
                    <p className="text-xs text-muted-foreground">
                        Writes {postsPerWeek * 4} draft posts over 4 weeks, spread across your funnel stage mix, with text for Facebook, Instagram and
                        LinkedIn and a suggested visual for each, plus a lead-magnet page, a sales page and a comment keyword auto-reply, all as
                        drafts. Uses about {postsPerWeek * 4 + 4} AI credits. Nothing is posted, published or switched on until you do it.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="plan-name" className="text-sm font-medium text-foreground">Plan name</label>
                    <input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={input} placeholder="Spring course launch" />
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">What you&apos;re selling</legend>
                    <div className="flex gap-2">
                        <button type="button" className={choice(offerType === "product")} aria-pressed={offerType === "product"} onClick={() => setOfferType("product")}>A product</button>
                        <button type="button" className={choice(offerType === "booking")} aria-pressed={offerType === "booking"} onClick={() => setOfferType("booking")}>A call</button>
                    </div>
                    {offerType === "product" ? (
                        data.products.length ? (
                            <select aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
                                {data.products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} ({(p.priceAmount / 100).toLocaleString()} {p.currency})</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No products yet. <Link href="/settings/payments" className="text-primary hover:underline">Add one in Settings &gt; Payments</Link>.
                            </p>
                        )
                    ) : (
                        <div className="space-y-2">
                            <input aria-label="Booking link" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} required className={input} placeholder="https://calendly.com/you/intro-call" />
                            <input aria-label="What the call is" value={callDescription} onChange={(e) => setCallDescription(e.target.value)} required minLength={3} maxLength={500} className={input} placeholder="A free 20-minute planning call" />
                        </div>
                    )}
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">Who it&apos;s for</legend>
                    <div className="flex gap-2">
                        <button type="button" className={choice(audienceMode === "pick")} aria-pressed={audienceMode === "pick"} disabled={data.icps.length === 0} onClick={() => setAudienceMode("pick")}>Pick an audience</button>
                        <button type="button" className={choice(audienceMode === "describe")} aria-pressed={audienceMode === "describe"} onClick={() => setAudienceMode("describe")}>Describe it</button>
                    </div>
                    {audienceMode === "pick" ? (
                        <select aria-label="Audience" value={icpId} onChange={(e) => setIcpId(e.target.value)} className={input}>
                            {data.icps.map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}
                        </select>
                    ) : (
                        <>
                            <textarea aria-label="Audience description" value={audience} onChange={(e) => setAudience(e.target.value)} required minLength={3} maxLength={500} rows={2} className={area} placeholder="Busy parents who want to cook healthy meals in less time" />
                            <p className="text-xs text-muted-foreground">Saved as a new audience you can reuse.</p>
                        </>
                    )}
                </fieldset>

                <div className="space-y-2">
                    <label htmlFor="plan-magnet" className="text-sm font-medium text-foreground">Free lead magnet</label>
                    <textarea id="plan-magnet" value={leadMagnet} onChange={(e) => setLeadMagnet(e.target.value)} required minLength={3} maxLength={500} rows={2} className={area} placeholder="A 5-day email course on batch cooking" />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <label htmlFor="plan-tone" className="text-sm font-medium text-foreground">Tone</label>
                        <input id="plan-tone" list="plan-tones" value={tone} onChange={(e) => setTone(e.target.value)} required maxLength={100} className={input} />
                        <datalist id="plan-tones">{TONES.map((t) => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="plan-start" className="text-sm font-medium text-foreground">Start date</label>
                        <input id="plan-start" type="date" value={startDate} min={tomorrow()} onChange={(e) => setStartDate(e.target.value)} required className={input} />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="plan-cadence" className="text-sm font-medium text-foreground">Posts a week</label>
                        <select id="plan-cadence" value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value))} className={input}>
                            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">Post to</legend>
                    {accounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No accounts yet; you can pick them per post later. <Link href="/settings/social" className="text-primary hover:underline">Connect Instagram or Facebook</Link>.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {accounts.map((a) => (
                                <li key={a.id}>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(a.id)}
                                            onChange={() => setAccountIds(selected.includes(a.id) ? selected.filter((x) => x !== a.id) : [...selected, a.id])}
                                        />
                                        <span className="text-foreground">{a.handle || a.platform}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                </fieldset>

                {hasTriggerAccount && (
                    <div className="space-y-2">
                        <label htmlFor="plan-keyword" className="text-sm font-medium text-foreground">Comment keyword</label>
                        <input
                            id="plan-keyword"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            required
                            pattern="[\p{L}\p{N}]{2,30}"
                            maxLength={30}
                            className={input}
                        />
                        <p className="text-xs text-muted-foreground">
                            Posts ask people to comment this word; an auto-reply (saved switched off) sends them the lead-magnet page.
                        </p>
                    </div>
                )}

                <div className="flex justify-end">
                    <button type="submit" disabled={busy || busyWriting || (offerType === "product" && !productId)} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                        {busy ? "Starting..." : busyWriting ? "A plan is being written..." : "Write my plan"}
                    </button>
                </div>
            </form>

            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Your plans</h3>
                {data.runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No plans yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {data.runs.map((run) => (
                            <li key={run.id}>
                                <Link href={`/content/plans/${encodeURIComponent(run.id)}`} className="block rounded-md border border-border p-3 hover:bg-muted/40">
                                    <div className="text-sm font-medium text-foreground">{run.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {run.stale ? "Stopped. Open it to try again." : PLAN_STATUS[run.status]} · {run._count.contentPosts} posts · {new Date(run.createdAt).toLocaleDateString()}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
