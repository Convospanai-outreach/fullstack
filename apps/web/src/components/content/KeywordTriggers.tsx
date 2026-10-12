"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

// Creator funnel keyword auto-replies (apps/api keywordTriggerService.ts). A comment or DM with
// one of the keywords gets an automatic DM (and, for comments, an optional public reply). New
// ones are saved switched off; switching one on lets it send on its own.

type Scope = "COMMENT" | "DM" | "BOTH";
type Match = "EXACT" | "CONTAINS";

export type KeywordTrigger = {
    id: string;
    socialAccountId: string;
    scope: Scope;
    keywords: string[];
    match: Match;
    contentPostId: string | null;
    replyText: string;
    publicCommentReply: string | null;
    landingPageId: string | null;
    mauticPageUrl: string | null;
    active: boolean;
    sentLast7Days: number;
    lastError: string | null;
};

type TriggerList = {
    triggers: KeywordTrigger[];
    accounts: { id: string; platform: "INSTAGRAM" | "FACEBOOK_PAGE"; handle: string | null; status: string }[];
    landingPages: { id: string; slug: string; title: string | null; status?: string }[];
    posts: { id: string; body: string; accountIds: string[] }[];
};

type Draft = {
    id: string | null;
    socialAccountId: string;
    scope: Scope;
    keywords: string;
    match: Match;
    contentPostId: string;
    replyText: string;
    publicCommentReply: string;
    landingPageId: string;
    mauticPageUrl: string;
};

const URL_BASE = getBrowserApiUrl("/content/keyword-triggers");
const REPLY_MAX_BYTES = 700; // keywordTriggers.ts REPLY_TEXT_MAX_BYTES
const SCOPE_LABEL: Record<Scope, string> = { COMMENT: "Comments", DM: "DMs", BOTH: "Comments and DMs" };
const PLATFORM_LABEL = { INSTAGRAM: "Instagram", FACEBOOK_PAGE: "Facebook Page" } as const;

// 404 = the creator funnel isn't on for this team: show nothing.
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`keyword triggers ${res.status}`);
    return res.json();
};

async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const res = await fetch(url, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Couldn't save. Try again.");
    return data;
}

const emptyDraft = (accountId = "", postId = ""): Draft => ({
    id: null,
    socialAccountId: accountId,
    scope: "COMMENT",
    keywords: "",
    match: "CONTAINS",
    contentPostId: postId,
    replyText: "",
    publicCommentReply: "",
    landingPageId: "",
    mauticPageUrl: "",
});

const fieldClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function KeywordTriggers() {
    const params = useSearchParams();
    const { data, error, mutate } = useSWR<TriggerList | null>(URL_BASE, fetcher);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    // ?trigger=new&post=<id> (from a live post in the calendar) opens the editor for that post.
    const postParam = params.get("trigger") === "new" ? params.get("post") : null;
    useEffect(() => {
        if (!postParam || !data || draft) return;
        const post = data.posts.find((p) => p.id === postParam);
        if (post) setDraft(emptyDraft(post.accountIds[0] ?? "", post.id));
    }, [postParam, data, draft]);

    if (error) return <p className="text-sm text-destructive">Couldn&apos;t load auto-replies.</p>;
    if (data === null) return null;
    if (!data) return <p className="text-sm text-muted-foreground">Loading auto-replies...</p>;

    const accountLabel = (id: string) => {
        const account = data.accounts.find((a) => a.id === id);
        return account ? account.handle || PLATFORM_LABEL[account.platform] : "Removed account";
    };
    const replyBytes = draft ? new TextEncoder().encode(draft.replyText).length : 0;
    const postsForAccount = draft ? data.posts.filter((p) => p.accountIds.includes(draft.socialAccountId)) : [];

    const save = async () => {
        if (!draft) return;
        setBusy("save");
        const body = {
            socialAccountId: draft.socialAccountId,
            scope: draft.scope,
            keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            match: draft.match,
            contentPostId: draft.scope === "DM" ? null : draft.contentPostId || null,
            replyText: draft.replyText,
            publicCommentReply: draft.scope === "DM" ? null : draft.publicCommentReply.trim() || null,
            landingPageId: draft.landingPageId || null,
            mauticPageUrl: draft.mauticPageUrl.trim() || null,
        };
        try {
            if (draft.id) await send(`${URL_BASE}/${encodeURIComponent(draft.id)}`, "PATCH", body);
            else await send(URL_BASE, "POST", body);
            toast.success(draft.id ? "Saved." : "Saved. Switch it on when you're ready.");
            setDraft(null);
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save.");
        } finally {
            setBusy(null);
        }
    };

    const toggle = async (trigger: KeywordTrigger) => {
        setBusy(trigger.id);
        try {
            await send(`${URL_BASE}/${encodeURIComponent(trigger.id)}`, "PATCH", { active: !trigger.active });
            toast.success(trigger.active ? "Switched off." : "Switched on. It now replies on its own.");
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't change it.");
        } finally {
            setBusy(null);
        }
    };

    const remove = async (trigger: KeywordTrigger) => {
        if (!window.confirm("Delete this auto-reply?")) return;
        setBusy(trigger.id);
        try {
            await send(`${URL_BASE}/${encodeURIComponent(trigger.id)}`, "DELETE");
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't delete it.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    When someone comments or DMs a keyword, send them a message automatically. Auto-replies only send once you switch them on.
                </p>
                {!draft && data.accounts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setDraft(emptyDraft(data.accounts[0]?.id ?? ""))}
                        className="h-9 shrink-0 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                    >
                        New auto-reply
                    </button>
                )}
            </div>

            {data.accounts.length === 0 && <p className="text-sm text-muted-foreground">Connect an Instagram account or Facebook Page first.</p>}

            {data.triggers.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {data.triggers.map((trigger) => (
                        <li key={trigger.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm text-foreground">
                                    <span className="font-medium">{trigger.keywords.join(", ")}</span>
                                    <span className="text-muted-foreground"> · {SCOPE_LABEL[trigger.scope]} on {accountLabel(trigger.socialAccountId)}</span>
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{trigger.replyText}</p>
                                <p className="text-xs text-muted-foreground">
                                    {trigger.active ? "On" : "Off"} · {trigger.sentLast7Days} sent in the last 7 days
                                </p>
                                {trigger.lastError && <p className="text-xs text-warning">Last problem: {trigger.lastError}</p>}
                            </div>
                            <div className="flex shrink-0 gap-3 text-xs">
                                <button type="button" disabled={busy !== null} onClick={() => toggle(trigger)} className="font-medium text-primary hover:underline disabled:opacity-50">
                                    {trigger.active ? "Switch off" : "Switch on"}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() =>
                                        setDraft({
                                            id: trigger.id,
                                            socialAccountId: trigger.socialAccountId,
                                            scope: trigger.scope,
                                            keywords: trigger.keywords.join(", "),
                                            match: trigger.match,
                                            contentPostId: trigger.contentPostId ?? "",
                                            replyText: trigger.replyText,
                                            publicCommentReply: trigger.publicCommentReply ?? "",
                                            landingPageId: trigger.landingPageId ?? "",
                                            mauticPageUrl: trigger.mauticPageUrl ?? "",
                                        })
                                    }
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                                >
                                    Edit
                                </button>
                                <button type="button" disabled={busy !== null} onClick={() => remove(trigger)} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {draft && (
                <div className="space-y-4 rounded-md border border-border p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Account</span>
                            <select
                                className={fieldClass}
                                value={draft.socialAccountId}
                                onChange={(e) => setDraft({ ...draft, socialAccountId: e.target.value, contentPostId: "" })}
                            >
                                {data.accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {(a.handle || PLATFORM_LABEL[a.platform]) + " · " + PLATFORM_LABEL[a.platform]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Reply to</span>
                            <select className={fieldClass} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Scope })}>
                                <option value="COMMENT">Comments</option>
                                <option value="DM">DMs</option>
                                <option value="BOTH">Comments and DMs</option>
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Keywords</span>
                            <input
                                className={fieldClass}
                                value={draft.keywords}
                                placeholder="guide, free guide"
                                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                            />
                            <span className="text-xs text-muted-foreground">Separate with commas. Case and punctuation don&apos;t matter.</span>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Match</span>
                            <select className={fieldClass} value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value as Match })}>
                                <option value="CONTAINS">The message contains the keyword</option>
                                <option value="EXACT">The message is just the keyword</option>
                            </select>
                        </label>
                        {draft.scope !== "DM" && (
                            <label className="space-y-1 text-sm">
                                <span className="font-medium text-foreground">Post</span>
                                <select className={fieldClass} value={draft.contentPostId} onChange={(e) => setDraft({ ...draft, contentPostId: e.target.value })}>
                                    <option value="">Any post</option>
                                    {postsForAccount.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.body || "(image post)"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Link to landing page</span>
                            <select className={fieldClass} value={draft.landingPageId} onChange={(e) => setDraft({ ...draft, landingPageId: e.target.value })}>
                                <option value="">No link</option>
                                {data.landingPages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title || `/p/${p.slug}`}{p.status && p.status !== "published" ? " (draft: publish it before switching on)" : ""}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Mautic page link (optional)</span>
                            <input
                                className={fieldClass}
                                type="url"
                                placeholder="https://mautic.craftmyfunnel.live/your-page"
                                value={draft.mauticPageUrl}
                                onChange={(e) => setDraft({ ...draft, mauticPageUrl: e.target.value })}
                            />
                            <span className="text-xs text-muted-foreground">Sent instead of the landing page above while Mautic is connected; the landing page is the fallback.</span>
                        </label>
                    </div>

                    <label className="block space-y-1 text-sm">
                        <span className="font-medium text-foreground">Message they get</span>
                        <textarea className={fieldClass} rows={3} value={draft.replyText} onChange={(e) => setDraft({ ...draft, replyText: e.target.value })} />
                        <span className={`text-xs ${replyBytes > REPLY_MAX_BYTES ? "text-destructive" : "text-muted-foreground"}`}>
                            {replyBytes} / {REPLY_MAX_BYTES} bytes{draft.landingPageId || draft.mauticPageUrl.trim() ? ". The page link is added after it." : ""}
                        </span>
                    </label>

                    {draft.scope !== "DM" && (
                        <label className="block space-y-1 text-sm">
                            <span className="font-medium text-foreground">Public reply under the comment (optional)</span>
                            <input
                                className={fieldClass}
                                value={draft.publicCommentReply}
                                maxLength={500}
                                placeholder="Sent you a DM!"
                                onChange={(e) => setDraft({ ...draft, publicCommentReply: e.target.value })}
                            />
                        </label>
                    )}

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setDraft(null)} className="h-9 rounded-md px-4 text-sm text-muted-foreground hover:text-foreground">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={busy !== null || !draft.socialAccountId || !draft.keywords.trim() || !draft.replyText.trim() || replyBytes > REPLY_MAX_BYTES}
                            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                            {busy === "save" ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
