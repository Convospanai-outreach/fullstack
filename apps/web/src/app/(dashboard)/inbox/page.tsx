"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { CalendarClock, CheckCircle2, Send } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StalledNudgeList } from "@/components/overseer/StalledNudgeList";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

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
    isRead: boolean;
    sentimentScore: number | null;
    createdAt: string;
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

type Tab = "replies" | "stalled" | "meetings";

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

function outcomeLabel(outcome: string | null) {
    return OUTCOMES.find((o) => o.value === outcome)?.label ?? null;
}

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

    const lead = thread?.lead;
    const currentOutcome = outcomeLabel(lead?.replyOutcome ?? reply.outcome);

    return (
        <GlassCard className="p-0 flex flex-col min-h-[520px]">
            <div className="border-b border-border p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{reply.leadName || reply.email || "Unknown lead"}</h3>
                    {currentOutcome && <Badge variant="info">{currentOutcome}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                    {[reply.company, reply.email].filter(Boolean).join(" · ")}
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
                <div className="flex flex-wrap gap-2">
                    {OUTCOMES.map((outcome) => (
                        <Button
                            key={outcome.value}
                            variant={lead?.replyOutcome === outcome.value ? "default" : "outline"}
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
                ) : (
                    <p className="text-xs text-muted-foreground">Replying from the inbox is available for email conversations only.</p>
                )}
            </div>
        </GlassCard>
    );
}

export default function InboxPage() {
    const [tab, setTab] = useState<Tab>("replies");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [olderReplies, setOlderReplies] = useState<InboxReply[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [stalledCount, setStalledCount] = useState<number | null>(null);
    const { data, error, mutate } = useSWR<InboxResponse>(getBrowserApiUrl(`/inbox?page=1&limit=${PAGE_SIZE}`), fetcher);

    const firstPage = data?.replies.items ?? [];
    const replies = [...firstPage, ...olderReplies.filter((r) => !firstPage.some((f) => f.id === r.id))];
    const selected = replies.find((r) => r.id === selectedId) ?? null;
    const hasMore = !!data && replies.length < data.replies.total;
    const onStalledCount = useCallback((count: number) => setStalledCount(count), []);

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
    const meetings = data?.meetings ?? [];

    return (
        <div className="space-y-6 max-w-6xl">
            <SectionHeader title="Inbox" subtitle="Replies, stalled leads, and upcoming meetings: everything that needs you today." />

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    <TabsTrigger value="replies">Replies ({counts?.unreadReplies ?? 0})</TabsTrigger>
                    <TabsTrigger value="stalled">Stalled ({stalledCount ?? counts?.openNudges ?? 0})</TabsTrigger>
                    <TabsTrigger value="meetings">Meetings ({meetings.length})</TabsTrigger>
                </TabsList>
            </Tabs>

            {error && (
                <GlassCard className="p-6 text-sm text-destructive">Couldn&apos;t load your inbox: {error.message}</GlassCard>
            )}
            {!data && !error && <div className="text-muted-foreground">Loading inbox...</div>}

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
                                                        {reply.leadName || reply.email || "Unknown lead"}
                                                    </span>
                                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                {reply.company && <p className="truncate text-xs text-muted-foreground">{reply.company}</p>}
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

            {data && tab === "stalled" && (
                <>
                    <StalledNudgeList onCountChange={onStalledCount} />
                    {stalledCount === 0 && <AllClear />}
                </>
            )}

            {data && tab === "meetings" && (
                meetings.length === 0 ? (
                    <AllClear />
                ) : (
                    <div className="grid gap-3">
                        {meetings.map((meeting) => (
                            <GlassCard key={meeting.id} className="flex items-center gap-4 p-5">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                                    <CalendarClock className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-foreground">{meeting.title}</p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {[meeting.lead?.fullName, meeting.lead?.company].filter(Boolean).join(" · ") || "No lead attached"}
                                    </p>
                                </div>
                                <p className="shrink-0 text-sm text-foreground">{format(new Date(meeting.startTime), "EEE d MMM, h:mm a")}</p>
                            </GlassCard>
                        ))}
                        <Link href="/calendar" className="text-sm text-primary hover:underline">Open calendar</Link>
                    </div>
                )
            )}
        </div>
    );
}
