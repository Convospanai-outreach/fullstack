"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { CheckCircle2, Send } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import ApprovalsPage from "../approvals/page";

interface InboxReply {
    id: string;
    leadId: string;
    leadName: string | null;
    company: string | null;
    email: string | null;
    outcome: string | null;
    platform: string;
    subject: string | null;
    campaignName: string | null;
    sequenceName: string | null;
    snippet: string;
    handle: string | null; // Instagram @username, for DMs
    replyWindowEndsAt: string | null; // Instagram/Facebook: replies are allowed until then
    isRead: boolean;
    sentimentScore: number | null;
    createdAt: string;
    suggestion: ReplySuggestion | null;
}

// AI suggestion only: nothing is applied until the rep clicks an outcome or sends a reply.
interface ReplySuggestion {
    classification: string;
    suggestedOutcome: string | null;
    askedNotToContact: boolean;
    confidence: number;
    reasoning: string | null;
    suggestedReply: string | null;
}

interface InboxMeeting {
    id: string;
    title: string;
    startTime: string;
    lead: { fullName: string | null; company: string | null } | null;
}

interface InboxResponse {
    replies: { items: InboxReply[]; page: number; limit: number; total: number };
    meetings: InboxMeeting[];
    counts: { unreadReplies: number; openNudges: number; meetingsToday: number };
}

interface ThreadResponse {
    lead: { id: string; fullName: string | null; company: string | null; email: string | null; replyOutcome: string | null };
    messages: { id: string; direction: string; sender: string | null; text: string; createdAt: string }[];
}

type Tab = "replies" | "approvals";

const PAGE_SIZE = 20;

const OUTCOMES = [
    { value: "interested", label: "Interested" },
    { value: "not_interested", label: "Not interested" },
    { value: "meeting_booked", label: "Meeting booked" },
    { value: "wrong_person", label: "Wrong person" },
] as const;

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Request failed");
    return res.json();
};

async function postJson(path: string, body?: unknown) {
    const res = await fetch(getBrowserApiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
}

// Instagram/Facebook DMs (creator funnel). Meta allows replies for 24 hours after the person's
// last message, and Instagram text must be 1,000 bytes or less; the API enforces both too.
const SOCIAL_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook" };
const INSTAGRAM_MAX_BYTES = 1000;

function displayName(reply: InboxReply) {
    const social = SOCIAL_LABEL[reply.platform];
    return reply.leadName || reply.handle || reply.email || (social ? `${social} contact` : "Unknown lead");
}

function outcomeLabel(outcome: string | null) {
    return OUTCOMES.find((o) => o.value === outcome)?.label ?? null;
}

const SUGGESTION_LABELS: Record<string, string> = {
    INTERESTED: "Looks interested",
    NOT_INTERESTED: "Looks not interested",
    OOO: "Out of office",
    QUESTION: "Asked a question",
    DNC: "Asked not to be contacted",
};

function SentimentDot({ score }: { score: number | null }) {
    const tone = score == null ? "bg-muted-foreground/40" : score >= 0.3 ? "bg-success" : score <= -0.3 ? "bg-destructive" : "bg-warning";
    const label = score == null ? "Sentiment not scored" : `Sentiment ${score.toFixed(1)}`;
    return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

function AllClear() {
    return (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success mb-3" />
            <p className="text-foreground font-medium">All clear. Nothing needs you right now.</p>
            <Link href="/campaigns" className="mt-2 text-sm text-primary hover:underline">
                Go to Campaigns
            </Link>
        </GlassCard>
    );
}

function ThreadPane({ reply, onChanged }: { reply: InboxReply; onChanged: () => void }) {
    const { data: thread, error, mutate } = useSWR<ThreadResponse>(getBrowserApiUrl(`/inbox/thread/${reply.leadId}`), fetcher);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [marking, setMarking] = useState<string | null>(null);
    const [openedAt] = useState(() => Date.now());
    const socialLabel = SOCIAL_LABEL[reply.platform];
    const windowOpen = reply.replyWindowEndsAt !== null && new Date(reply.replyWindowEndsAt).getTime() > openedAt;
    const draftBytes = new TextEncoder().encode(draft).length;
    const tooLong = reply.platform === "INSTAGRAM" && draftBytes > INSTAGRAM_MAX_BYTES;

    const sendReply = async () => {
        if (!draft.trim()) return;
        setSending(true);
        try {
            await postJson(`/inbox/replies/${reply.id}/reply`, { content: draft });
            setDraft("");
            toast.success("Reply sent");
            mutate();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    const markOutcome = async (outcome: string) => {
        setMarking(outcome);
        try {
            await postJson(`/inbox/replies/${reply.id}/mark`, { outcome });
            toast.success(`Marked ${outcomeLabel(outcome)?.toLowerCase()}. Follow-ups for this lead are stopped.`);
            mutate();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save outcome");
        } finally {
            setMarking(null);
        }
    };

    const markDoNotContact = async () => {
        setMarking("do_not_contact");
        try {
            await postJson(`/inbox/replies/${reply.id}/do-not-contact`, {});
            toast.success("Added to the do-not-contact list and marked not interested. Follow-ups for this lead are stopped.");
            mutate();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add to the do-not-contact list");
        } finally {
            setMarking(null);
        }
    };

    const lead = thread?.lead;
    const currentOutcome = outcomeLabel(lead?.replyOutcome ?? reply.outcome);
    const suggestion = reply.suggestion;

    return (
        <GlassCard className="p-0 flex flex-col min-h-[520px]">
            <div className="border-b border-border p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{displayName(reply)}</h3>
                    {socialLabel && <Badge variant="outline">{socialLabel}</Badge>}
                    {currentOutcome && <Badge variant="info">{currentOutcome}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                    {[reply.handle, reply.company, reply.email].filter(Boolean).join(" · ")}
                </p>
                {(reply.campaignName || reply.sequenceName) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {[reply.campaignName, reply.sequenceName].filter(Boolean).join(" / ")}
                    </p>
                )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5 max-h-[420px]">
                {error && <p className="text-sm text-destructive">Couldn&apos;t load this conversation.</p>}
                {!thread && !error && <p className="text-sm text-muted-foreground">Loading conversation...</p>}
                {thread?.messages.map((message) => {
                    const outbound = message.direction === "OUTBOUND";
                    return (
                        <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${outbound ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"}`}>
                                <p className="whitespace-pre-wrap break-words">{message.text}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {outbound ? message.sender || "You" : "Them"} · {format(new Date(message.createdAt), "d MMM, h:mm a")}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="border-t border-border p-5 space-y-3">
                {suggestion && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="info">AI suggestion</Badge>
                            <span className="font-medium text-foreground">{SUGGESTION_LABELS[suggestion.classification] ?? suggestion.classification}</span>
                            <span className="text-xs text-muted-foreground">{Math.round(suggestion.confidence * 100)}% confident</span>
                        </div>
                        {suggestion.askedNotToContact && (
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-muted-foreground">They asked not to be contacted. Nothing is done until you click.</p>
                                <Button variant="destructive" size="sm" disabled={!!marking} onClick={markDoNotContact}>
                                    {marking === "do_not_contact" ? "Saving..." : "Do not contact"}
                                </Button>
                            </div>
                        )}
                        {suggestion.reasoning && <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>}
                        {suggestion.suggestedReply && reply.platform === "EMAIL" && (
                            <Button variant="ghost" size="sm" onClick={() => setDraft(suggestion.suggestedReply ?? "")}>
                                Use suggested reply
                            </Button>
                        )}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {OUTCOMES.map((outcome) => (
                        <Button
                            key={outcome.value}
                            variant={lead?.replyOutcome === outcome.value ? "default" : "outline"}
                            className={suggestion?.suggestedOutcome === outcome.value && lead?.replyOutcome !== outcome.value ? "ring-2 ring-primary/50" : undefined}
                            title={suggestion?.suggestedOutcome === outcome.value ? "Suggested by AI" : undefined}
                            size="sm"
                            disabled={!!marking}
                            onClick={() => markOutcome(outcome.value)}
                        >
                            {marking === outcome.value ? "Saving..." : outcome.label}
                        </Button>
                    ))}
                </div>
                {reply.platform === "EMAIL" ? (
                    <>
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Write a reply. It goes out from the mailbox that sent the original email."
                            maxLength={2200}
                            rows={4}
                        />
                        <div className="flex justify-end">
                            <Button onClick={sendReply} disabled={sending || !draft.trim()}>
                                <Send className="w-4 h-4 mr-2" />
                                {sending ? "Sending..." : "Send reply"}
                            </Button>
                        </div>
                    </>
                ) : socialLabel && windowOpen ? (
                    <>
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={`Write a reply. It's sent as a ${socialLabel} message.`}
                            maxLength={2200}
                            rows={4}
                        />
                        <div className="flex items-center justify-between gap-3">
                            <p className={`text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
                                {reply.platform === "INSTAGRAM" && `${draftBytes} / ${INSTAGRAM_MAX_BYTES} bytes · `}
                                You can reply until {format(new Date(reply.replyWindowEndsAt as string), "d MMM, h:mm a")}
                            </p>
                            <Button onClick={sendReply} disabled={sending || !draft.trim() || tooLong}>
                                <Send className="w-4 h-4 mr-2" />
                                {sending ? "Sending..." : "Send reply"}
                            </Button>
                        </div>
                    </>
                ) : socialLabel ? (
                    <p className="text-xs text-muted-foreground">
                        {socialLabel} only allows replies within 24 hours of the person&apos;s last message. You can reply once they message you again.
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground">Replying from the inbox is available for email, Instagram and Facebook conversations.</p>
                )}
            </div>
        </GlassCard>
    );
}

export default function InboxPage() {
    // ?tab=approvals deep-links here; /approvals redirects to it. ?reply=<id> opens that thread.
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab: Tab = searchParams?.get("tab") === "approvals" ? "approvals" : "replies";
    const replyParam = searchParams?.get("reply") ?? null;
    const setTab = (next: Tab) => router.replace(next === "approvals" ? "/inbox?tab=approvals" : "/inbox");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [olderReplies, setOlderReplies] = useState<InboxReply[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const { data, error, mutate } = useSWR<InboxResponse>(getBrowserApiUrl(`/inbox?page=1&limit=${PAGE_SIZE}`), fetcher);
    const { data: approvals } = useSWR<{ requests: unknown[] }>("/api/approvals", fetcher);

    const firstPage = data?.replies.items ?? [];
    const replies = [...firstPage, ...olderReplies.filter((r) => !firstPage.some((f) => f.id === r.id))];
    const selected = replies.find((r) => r.id === selectedId) ?? null;
    const hasMore = !!data && replies.length < data.replies.total;

    const refresh = () => {
        setOlderReplies([]);
        mutate();
    };

    const selectReply = async (reply: InboxReply) => {
        setSelectedId(reply.id);
        if (reply.isRead) return;
        try {
            await postJson(`/inbox/replies/${reply.id}/read`);
            setOlderReplies((current) => current.map((r) => (r.id === reply.id ? { ...r, isRead: true } : r)));
            mutate();
        } catch {
            // Non-critical: the reply stays bold until the next refresh.
        }
    };

    // Open the deep-linked reply once the first page loads (it's recent, so it's on page 1).
    useEffect(() => {
        if (!replyParam || selectedId) return;
        const target = data?.replies.items.find((r) => r.id === replyParam);
        if (target) void selectReply(target);
    }, [data, replyParam]);

    const loadMore = async () => {
        if (!data) return;
        setLoadingMore(true);
        try {
            const page = Math.floor(replies.length / PAGE_SIZE) + 1;
            const next: InboxResponse = await fetcher(getBrowserApiUrl(`/inbox?page=${page}&limit=${PAGE_SIZE}`));
            setOlderReplies((current) => [...current, ...next.replies.items]);
        } catch {
            toast.error("Couldn't load more replies");
        } finally {
            setLoadingMore(false);
        }
    };

    const counts = data?.counts;

    return (
        <div className="space-y-6 max-w-6xl">
            <SectionHeader title="Inbox" subtitle="Replies to answer and actions waiting for your approval." />

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    <TabsTrigger value="replies">Replies ({counts?.unreadReplies ?? 0})</TabsTrigger>
                    <TabsTrigger value="approvals">Approvals ({approvals?.requests?.length ?? 0})</TabsTrigger>
                </TabsList>
            </Tabs>

            {tab === "approvals" && <ApprovalsPage />}

            {tab === "replies" && error && (
                <GlassCard className="p-6 text-sm text-destructive">Couldn&apos;t load your inbox: {error.message}</GlassCard>
            )}
            {tab === "replies" && !data && !error && <div className="text-muted-foreground">Loading inbox...</div>}

            {data && tab === "replies" && (
                replies.length === 0 ? (
                    <AllClear />
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                        <GlassCard className="p-0 overflow-hidden">
                            <ul className="divide-y divide-border">
                                {replies.map((reply) => (
                                    <li key={reply.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectReply(reply)}
                                            className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${selectedId === reply.id ? "bg-muted" : ""}`}
                                        >
                                            <SentimentDot score={reply.sentimentScore} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className={`truncate text-sm ${reply.isRead ? "text-foreground" : "font-semibold text-foreground"}`}>
                                                        {displayName(reply)}
                                                    </span>
                                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                {(SOCIAL_LABEL[reply.platform] || reply.company) && (
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {[SOCIAL_LABEL[reply.platform], reply.company].filter(Boolean).join(" · ")}
                                                    </p>
                                                )}
                                                <p className={`mt-0.5 line-clamp-2 text-xs ${reply.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                                                    {reply.snippet}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {hasMore && (
                                <div className="border-t border-border p-3 text-center">
                                    <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                                        {loadingMore ? "Loading..." : "Load older replies"}
                                    </Button>
                                </div>
                            )}
                        </GlassCard>

                        {selected ? (
                            <ThreadPane key={selected.id} reply={selected} onChanged={refresh} />
                        ) : (
                            <GlassCard className="flex min-h-[520px] items-center justify-center p-8 text-sm text-muted-foreground">
                                Select a reply to read the conversation and respond.
                            </GlassCard>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
