"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import {
    fromLocalInput,
    isEditable,
    STAGE_META,
    STAGES,
    STATUS_LABEL,
    toLocalInput,
    type CalendarAccount,
    type CalendarPost,
    type FunnelStage,
} from "@/lib/contentCalendar";

const POSTS_URL = getBrowserApiUrl("/content/posts");
const PLATFORM_LABEL: Record<string, string> = {
    FACEBOOK_PAGE: "Facebook Page",
    INSTAGRAM: "Instagram",
    LINKEDIN_MEMBER: "LinkedIn profile",
    LINKEDIN_ORG: "LinkedIn page",
};

// Instagram image rules, checked 2026-09-30 at
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media:
// JPEG, "8 MB maximum", aspect ratio "within a 4:5 to 1.91:1 range", caption "Maximum 2200 characters".
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;
const IG_CAPTION_MAX = 2200;
const MAX_IMAGES = 10;

function imageRatio(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img.naturalWidth / img.naturalHeight);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("unreadable"));
        };
        img.src = url;
    });
}

async function errorMessage(res: Response, fallback: string) {
    const body = await res.json().catch(() => null);
    return typeof body?.error === "string" ? body.error : fallback;
}

type Props = {
    open: boolean;
    onClose: () => void;
    post: CalendarPost | null;
    defaultWhen: Date | null;
    accounts: CalendarAccount[];
    onChanged: () => void;
};

// Write, schedule and send a post for approval. Nothing is posted from here: publishing only
// happens once the post is approved (Inbox > Approvals, or the buttons below for approvers).
export function PostComposer({ open, onClose, post, defaultWhen, accounts, onChanged }: Props) {
    const [body, setBody] = useState("");
    const [igCaption, setIgCaption] = useState("");
    const [linkedinCaption, setLinkedinCaption] = useState("");
    const [visualBrief, setVisualBrief] = useState("");
    const [stage, setStage] = useState<FunnelStage>("TOFU");
    const [accountIds, setAccountIds] = useState<string[]>([]);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [when, setWhen] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setBody(post?.body ?? "");
        setIgCaption(post?.channelCaptions?.INSTAGRAM ?? "");
        setLinkedinCaption(post?.channelCaptions?.LINKEDIN ?? "");
        setVisualBrief(post?.visualBrief ?? "");
        setStage(post?.funnelStage ?? "TOFU");
        setAccountIds(post ? post.targets.map((t) => t.socialAccount.id) : accounts.filter((a) => a.status === "CONNECTED").map((a) => a.id));
        setMediaUrls(post?.mediaUrls ?? []);
        setWhen(toLocalInput(post?.scheduledAt ? new Date(post.scheduledAt) : defaultWhen));
        setNote("");
    }, [open, post, defaultWhen, accounts]);

    const editable = !post || isEditable(post);
    // A post can still target an account that was disconnected since; list it so it can be unchecked.
    const choices = [...accounts, ...(post?.targets.map((t) => t.socialAccount).filter((a) => !accounts.some((x) => x.id === a.id)) ?? [])];
    // Accounts this post is already live on: they stay selected and the post can't be deleted.
    const live = new Set(post?.targets.filter((t) => t.status === "PUBLISHED").map((t) => t.socialAccount.id) ?? []);
    const hasInstagram = choices.some((a) => a.platform === "INSTAGRAM" && accountIds.includes(a.id));
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        if (mediaUrls.length + files.length > MAX_IMAGES) {
            toast.error(`A post can have at most ${MAX_IMAGES} images.`);
            return;
        }
        setBusy("upload");
        try {
            const added: string[] = [];
            for (const file of Array.from(files)) {
                if (file.type !== "image/jpeg") throw new Error(`${file.name}: only JPEG images work on Instagram.`);
                if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: images can be at most 8 MB.`);
                const ratio = await imageRatio(file).catch(() => 0);
                if (ratio < MIN_RATIO - 0.005 || ratio > MAX_RATIO + 0.005) {
                    throw new Error(`${file.name}: Instagram needs a shape between 4:5 (portrait) and 1.91:1 (wide).`);
                }
                const form = new FormData();
                form.set("file", file);
                const res = await fetch("/api/content/media", { method: "POST", body: form });
                if (!res.ok) throw new Error(await errorMessage(res, "Upload failed. Try again."));
                added.push((await res.json()).url);
            }
            setMediaUrls((current) => [...current, ...added]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed.");
        } finally {
            setBusy(null);
            if (fileInput.current) fileInput.current.value = "";
        }
    };

    const save = async (): Promise<string | null> => {
        const scheduledAt = fromLocalInput(when);
        const payload = {
            body,
            channelCaptions: { INSTAGRAM: igCaption, LINKEDIN: linkedinCaption },
            visualBrief: visualBrief.trim() || null,
            funnelStage: stage,
            mediaUrls,
            accountIds,
            scheduledAt: scheduledAt?.toISOString() ?? null,
            timezone,
        };
        const res = await fetch(post ? `${POSTS_URL}/${encodeURIComponent(post.id)}` : POSTS_URL, {
            method: post ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            toast.error(await errorMessage(res, "Couldn't save the post."));
            return null;
        }
        return (await res.json()).post.id as string;
    };

    const run = async (key: string, action: () => Promise<boolean>) => {
        setBusy(key);
        try {
            if (await action()) {
                onChanged();
                onClose();
            }
        } finally {
            setBusy(null);
        }
    };

    const saveDraft = () => run("save", async () => {
        const id = await save();
        if (id) toast.success("Saved.");
        return !!id;
    });

    const sendForApproval = () => run("submit", async () => {
        const id = await save();
        if (!id) return false;
        const res = await fetch(`${POSTS_URL}/${encodeURIComponent(id)}/submit`, { method: "POST" });
        if (!res.ok) {
            toast.error(await errorMessage(res, "Couldn't send it for approval."));
            onChanged(); // the draft itself was saved
            return false;
        }
        toast.success("Sent for approval. It's in Inbox > Approvals.");
        return true;
    });

    const decide = (action: "APPROVE" | "REJECT") => run(action, async () => {
        if (!post?.approvalRequestId) return false;
        const res = await fetch(`/api/approvals/${encodeURIComponent(post.approvalRequestId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason: note.trim() || undefined }),
        });
        if (res.status === 403) {
            toast.error("Only workspace owners and admins can approve posts.");
            return false;
        }
        if (!res.ok) {
            toast.error(await errorMessage(res, "Couldn't record that. Reload and try again."));
            return false;
        }
        toast.success(action === "APPROVE" ? "Approved." : "Sent back to draft.");
        return true;
    });

    const remove = () => run("delete", async () => {
        if (!post || !window.confirm("Delete this post?")) return false;
        const res = await fetch(`${POSTS_URL}/${encodeURIComponent(post.id)}`, { method: "DELETE" });
        if (!res.ok) {
            toast.error(await errorMessage(res, "Couldn't delete the post."));
            return false;
        }
        toast.success("Deleted.");
        return true;
    });

    const toggleAccount = (id: string) => setAccountIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    // Instagram gets its own caption when there is one, else the post text.
    const captionLength = [...(igCaption.trim() ? igCaption : body)].length;
    const hasLinkedin = choices.some((a) => a.platform.startsWith("LINKEDIN") && accountIds.includes(a.id));

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="left-auto right-0 top-0 h-full max-h-screen w-full translate-x-0 translate-y-0 overflow-y-auto sm:max-w-xl sm:rounded-none">
                <DialogHeader>
                    <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
                    <DialogDescription>
                        {post ? STATUS_LABEL[post.status] : "Draft"}. Nothing is posted until the post is approved.
                    </DialogDescription>
                </DialogHeader>

                {post?.reviewNote && (post.status === "DRAFT" || post.status === "FAILED") && (
                    <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">{post.reviewNote}</p>
                )}
                {post && (post.status === "IN_REVIEW" || post.status === "APPROVED") && (
                    <p className="text-xs text-muted-foreground">
                        Changing the text (or a channel&apos;s own text), images or accounts sends it back for approval. Moving it to another time doesn&apos;t.
                    </p>
                )}
                {post && live.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                        <Link href={`/settings/social?trigger=new&post=${encodeURIComponent(post.id)}`} className="font-medium text-primary hover:underline">
                            Comment keyword &rarr; DM
                        </Link>
                        : automatically message people who comment a keyword on this post.
                    </p>
                )}

                <fieldset disabled={!editable || busy !== null} className="space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="post-body" className="text-sm font-medium text-foreground">Post text</label>
                        {(hasInstagram || igCaption || linkedinCaption) && (
                            <p className="text-xs text-muted-foreground">Used on Facebook, and anywhere below that has no text of its own.</p>
                        )}
                        <textarea
                            id="post-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={7}
                            className="w-full rounded-md border border-border bg-background p-3 text-sm"
                            placeholder="What do you want to say?"
                        />
                        {hasInstagram && !igCaption.trim() && (
                            <p className={`text-right text-xs ${captionLength > IG_CAPTION_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                                {captionLength} / {IG_CAPTION_MAX}
                            </p>
                        )}
                    </div>

                    {(hasInstagram || igCaption || post?.channelCaptions?.INSTAGRAM) && (
                        <div className="space-y-2">
                            <label htmlFor="post-ig" className="text-sm font-medium text-foreground">Instagram caption (optional)</label>
                            <textarea
                                id="post-ig"
                                value={igCaption}
                                onChange={(e) => setIgCaption(e.target.value)}
                                rows={5}
                                className="w-full rounded-md border border-border bg-background p-3 text-sm"
                                placeholder="Leave empty to use the post text"
                            />
                            {igCaption.trim() && (
                                <p className={`text-right text-xs ${captionLength > IG_CAPTION_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                                    {captionLength} / {IG_CAPTION_MAX}
                                </p>
                            )}
                        </div>
                    )}

                    {(hasLinkedin || linkedinCaption || post?.channelCaptions?.LINKEDIN) && (
                        <div className="space-y-2">
                            <label htmlFor="post-linkedin" className="text-sm font-medium text-foreground">LinkedIn text (optional)</label>
                            <textarea
                                id="post-linkedin"
                                value={linkedinCaption}
                                onChange={(e) => setLinkedinCaption(e.target.value)}
                                rows={5}
                                className="w-full rounded-md border border-border bg-background p-3 text-sm"
                                placeholder="Leave empty to use the post text"
                            />
                            <p className="text-xs text-muted-foreground">Kept for when LinkedIn posting is available.</p>
                        </div>
                    )}

                    {(visualBrief || post?.visualBrief) && (
                        <div className="space-y-2">
                            <label htmlFor="post-visual" className="text-sm font-medium text-foreground">Suggested visual</label>
                            <textarea
                                id="post-visual"
                                value={visualBrief}
                                onChange={(e) => setVisualBrief(e.target.value)}
                                rows={2}
                                className="w-full rounded-md border border-border bg-background p-3 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">A note for you; it isn&apos;t posted.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Funnel stage</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {STAGES.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStage(s)}
                                    aria-pressed={stage === s}
                                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${stage === s ? STAGE_META[s].className : "border-border text-muted-foreground"}`}
                                >
                                    <span className="block font-semibold">{s}</span>
                                    {STAGE_META[s].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Post to</p>
                        {choices.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No accounts yet. <Link href="/settings/social" className="text-primary hover:underline">Connect Instagram or Facebook</Link>.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {choices.map((a) => (
                                    <li key={a.id}>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={accountIds.includes(a.id)} disabled={live.has(a.id)} onChange={() => toggleAccount(a.id)} />
                                            <span className="text-foreground">{a.handle || PLATFORM_LABEL[a.platform]}</span>
                                            <span className="text-xs text-muted-foreground">{PLATFORM_LABEL[a.platform]}</span>
                                            {live.has(a.id) && <span className="text-xs text-success">posted</span>}
                                            {a.status !== "CONNECTED" && (
                                                <span className="text-xs text-warning">{a.status === "DISCONNECTED" ? "disconnected" : "needs reconnecting"}</span>
                                            )}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Images</p>
                        <div className="flex flex-wrap gap-2">
                            {mediaUrls.map((url) => (
                                <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                    {editable && (
                                        <button
                                            type="button"
                                            aria-label="Remove image"
                                            onClick={() => setMediaUrls((urls) => urls.filter((u) => u !== url))}
                                            className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {editable && mediaUrls.length < MAX_IMAGES && (
                                <button
                                    type="button"
                                    onClick={() => fileInput.current?.click()}
                                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <ImagePlus className="h-5 w-5" />
                                    {busy === "upload" ? "Uploading..." : "Add"}
                                </button>
                            )}
                        </div>
                        <input ref={fileInput} type="file" accept="image/jpeg" multiple hidden onChange={(e) => upload(e.target.files)} />
                        <p className="text-xs text-muted-foreground">JPEG, up to 8 MB, between 4:5 portrait and 1.91:1 wide. Instagram needs at least one.</p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="post-when" className="text-sm font-medium text-foreground">When</label>
                        <input
                            id="post-when"
                            type="datetime-local"
                            value={when}
                            onChange={(e) => setWhen(e.target.value)}
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Your time zone: {timezone}</p>
                    </div>
                </fieldset>

                {post?.status === "IN_REVIEW" && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                        <p className="text-sm font-medium text-foreground">Approve this post</p>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note for the author (optional)"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" disabled={busy !== null} onClick={() => decide("REJECT")} className="h-9 rounded-md border border-destructive/30 px-3 text-sm text-destructive disabled:opacity-50">
                                {busy === "REJECT" ? "Saving..." : "Send back"}
                            </button>
                            <button type="button" disabled={busy !== null} onClick={() => decide("APPROVE")} className="h-9 rounded-md bg-success px-3 text-sm font-medium text-white disabled:opacity-50">
                                {busy === "APPROVE" ? "Saving..." : "Approve"}
                            </button>
                        </div>
                    </div>
                )}

                {post?.targets.some((t) => t.lastError) && (
                    <ul className="space-y-1 text-xs text-destructive">
                        {post.targets.filter((t) => t.lastError).map((t) => (
                            <li key={t.id}>{t.socialAccount.handle || PLATFORM_LABEL[t.socialAccount.platform]}: {t.lastError}</li>
                        ))}
                    </ul>
                )}

                {editable && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                        {post && live.size === 0 ? (
                            <button type="button" disabled={busy !== null} onClick={remove} className="text-sm text-muted-foreground hover:text-destructive disabled:opacity-50">
                                {busy === "delete" ? "Deleting..." : "Delete"}
                            </button>
                        ) : <span />}
                        <div className="flex gap-2">
                            <button type="button" disabled={busy !== null} onClick={saveDraft} className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50">
                                {busy === "save" ? "Saving..." : post && post.status !== "DRAFT" && post.status !== "FAILED" ? "Save" : "Save draft"}
                            </button>
                            {(!post || post.status === "DRAFT" || post.status === "FAILED") && (
                                <button type="button" disabled={busy !== null} onClick={sendForApproval} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
                                    {busy === "submit" ? "Sending..." : "Send for approval"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
