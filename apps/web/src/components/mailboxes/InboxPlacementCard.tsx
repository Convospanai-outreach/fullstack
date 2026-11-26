"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type Level = "green" | "amber" | "red";
type Folder = "inbox" | "promotions" | "spam" | "missing" | "error";
interface Auth { dkim: string; aligned: boolean; spf: string; dmarc: string }
interface PlacementView {
    state: null | {
        status: "queued" | "running" | "done" | "failed";
        checkedAt: string | null;
        contentSource: "campaign" | "sample";
        sent: number;
        error: string | null;
        acceptedAt: string | null;
        results: { provider: "gmail" | "yahoo" | "other"; folder: Folder; auth: Auth | null; error: string | null }[];
    };
    verdict: { level: Level; reasons: string[] };
}

const LEVEL_STYLE: Record<Level, { label: string; className: string }> = {
    green: { label: "No problems found", className: "bg-success/10 text-success border-success/20" },
    amber: { label: "Check before sending", className: "bg-warning/10 text-warning border-warning/20" },
    red: { label: "Problem found", className: "bg-destructive/10 text-destructive border-destructive/20" },
};
const FOLDER_LABEL: Record<Folder, string> = { inbox: "Inbox", promotions: "Promotions", spam: "Spam", missing: "Not received", error: "Could not check" };
const PROVIDER_LABEL = { gmail: "Gmail", yahoo: "Yahoo", other: "Test inbox" } as const;

// Inbox placement for one mailbox: the last check's green/amber/red verdict and a button to run a new one.
export default function InboxPlacementCard({ mailboxId }: { mailboxId: string }) {
    const [view, setView] = useState<PlacementView | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const url = getBrowserApiUrl(`/mailboxes/${mailboxId}/placement-check`);

    const load = useCallback(async () => {
        try {
            const res = await fetch(url);
            if (res.ok) setView((await res.json()) as PlacementView);
        } catch {
            // the card stays empty; the rest of the page still works
        }
    }, [url]);

    useEffect(() => { void load(); }, [load]);

    const running = view?.state?.status === "queued" || view?.state?.status === "running";
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => { void load(); }, 10_000);
        return () => clearInterval(timer);
    }, [running, load]);

    async function act(method: "POST" | "PATCH") {
        if (method === "PATCH" && !window.confirm("Accept this result? Campaigns from this mailbox can then start even though a test email went to spam or failed authentication.")) return;
        setBusy(true);
        setError("");
        try {
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(method === "PATCH" ? { accept: true } : {}) });
            const body = await res.json().catch(() => null);
            if (!res.ok) setError(body?.error || "That did not work. Try again.");
            else setView(body as PlacementView);
        } catch {
            setError("That did not work. Try again.");
        } finally {
            setBusy(false);
        }
    }

    const level = view?.verdict.level ?? "amber";
    const state = view?.state ?? null;
    const style = LEVEL_STYLE[level];

    return (
        <div className="rounded-lg border border-border bg-muted p-3 text-xs space-y-2" data-testid="inbox-placement">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Inbox placement</span>
                {running ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Checking. This takes up to 5 minutes.</span>
                ) : (
                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${style.className}`}>{style.label}</span>
                )}
                {state?.checkedAt && !running && (
                    <span className="text-muted-foreground">Checked {new Date(state.checkedAt).toLocaleString()}</span>
                )}
                <div className="ml-auto flex gap-2">
                    {level === "red" && !state?.acceptedAt && !running && (
                        <button type="button" disabled={busy} onClick={() => act("PATCH")} className="rounded-md border border-border px-2.5 py-1 font-medium text-foreground hover:bg-background disabled:opacity-50">
                            Accept result
                        </button>
                    )}
                    <button type="button" disabled={busy || running} onClick={() => act("POST")} className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {busy ? "Starting..." : "Run check"}
                    </button>
                </div>
            </div>

            {!running && state?.status === "done" && state.results.length > 0 && (
                <ul className="space-y-1">
                    {state.results.map((r, i) => (
                        <li key={i} className="flex flex-wrap gap-x-3 text-foreground">
                            <span className="font-medium">{PROVIDER_LABEL[r.provider]}</span>
                            <span className={r.folder === "spam" ? "text-destructive" : r.folder === "inbox" ? "text-success" : "text-warning"}>{FOLDER_LABEL[r.folder]}</span>
                            {r.auth && <span className="text-muted-foreground">DKIM {r.auth.dkim}{r.auth.dkim === "pass" && !r.auth.aligned ? " (not aligned)" : ""}, SPF {r.auth.spf}, DMARC {r.auth.dmarc}</span>}
                            {r.error && <span className="text-muted-foreground">{r.error}</span>}
                        </li>
                    ))}
                </ul>
            )}

            {!running && (
                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    {(view?.verdict.reasons ?? []).map((reason, i) => <li key={i}>{reason}</li>)}
                    {state?.status === "failed" && state.error && <li className="text-destructive">{state.error}</li>}
                </ul>
            )}

            <p className="text-muted-foreground">
                Sends one copy of your campaign&apos;s first email{state?.contentSource === "sample" ? " (or a sample email when you have no campaign yet)" : ""} to a few test inboxes, then reads where it landed without opening or replying. It counts toward today&apos;s sending limit. Green means no problem was found at the test inboxes, not a guarantee for every recipient. A red result stops campaigns from this mailbox until you fix it or an admin accepts it.
            </p>
            {error && <p role="alert" className="text-destructive">{error}</p>}
        </div>
    );
}
