"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
    Search,
    Mail,
    Sparkles,
    Send,
    User,
    Building2,
    Loader2,
    Inbox,
    Archive,
    Trash2,
    Send as SendIcon,
    MoreHorizontal,
    Reply
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Thread } from "@/types/common";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InboxPage() {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [activeFolder, setActiveFolder] = useState("inbox");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const queryUrl = useMemo(() => {
        const params = new URLSearchParams();
        // Map folder to status filters if needed, for now just passing 'status' for real implementations
        if (activeFolder === "inbox") params.append("status", "ACTIVE");
        if (debouncedSearch) params.append("search", debouncedSearch);
        return `/api/inbox?${params.toString()}`;
    }, [activeFolder, debouncedSearch]);

    const { data: threads, isLoading } = useSWR<Thread[]>(queryUrl, fetcher, {
        refreshInterval: 10000,
        revalidateOnFocus: true
    });

    // Auto-select first thread on load if none selected
    useEffect(() => {
        if (!isLoading && threads?.length && !selectedThreadId && threads[0]) {
            setSelectedThreadId(threads[0].id);
        }
    }, [isLoading, threads, selectedThreadId]);

    const validThreads = Array.isArray(threads) ? threads : [];

    return (
        <AppShell>
            <div className="h-[calc(100vh-140px)] flex rounded-2xl overflow-hidden glass-strong border border-white/10 shadow-2xl animate-reveal">

                {/* 1. Folders Navigation Rail */}
                <div className="w-64 bg-black/20 border-r border-white/5 flex flex-col p-4">
                    <div className="flex items-center gap-3 px-2 mb-8">
                        <div className="p-2 bg-accent-blue/10 rounded-lg text-accent-blue">
                            <Inbox className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg text-white tracking-tight">Unified Box</span>
                    </div>

                    <div className="space-y-1">
                        <FolderItem
                            label="Inbox"
                            icon={Inbox}
                            active={activeFolder === "inbox"}
                            count={validThreads.filter((t: any) => t.unreadCount > 0).length}
                            onClick={() => setActiveFolder("inbox")}
                        />
                        <FolderItem
                            label="Sent"
                            icon={SendIcon}
                            active={activeFolder === "sent"}
                            onClick={() => setActiveFolder("sent")}
                        />
                        <FolderItem
                            label="Archived"
                            icon={Archive}
                            active={activeFolder === "archive"}
                            onClick={() => setActiveFolder("archive")}
                        />
                        <FolderItem
                            label="Trash"
                            icon={Trash2}
                            active={activeFolder === "trash"}
                            onClick={() => setActiveFolder("trash")}
                        />
                    </div>

                    <div className="mt-8 px-2">
                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Labels</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-white transition">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                High Value
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-white transition">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                Follow Up
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-white transition">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                LinkedIn
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Thread List */}
                <div className="w-80 border-r border-white/5 bg-white/[0.02] flex flex-col">
                    <div className="p-4 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent-blue transition-all placeholder:text-text-muted"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-4 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-3">
                                        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : validThreads.length === 0 ? (
                            <div className="p-8 text-center text-text-muted">
                                <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No messages found</p>
                            </div>
                        ) : (
                            validThreads.map((thread: any) => (
                                <div
                                    key={thread.id}
                                    onClick={() => setSelectedThreadId(thread.id)}
                                    className={`p-4 border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.04] transition-all relative group ${selectedThreadId === thread.id ? "bg-white/[0.06]" : ""
                                        }`}
                                >
                                    {selectedThreadId === thread.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-blue shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    )}

                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {thread.unreadCount > 0 && (
                                                <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0 animate-pulse" />
                                            )}
                                            <h3 className={`font-semibold text-sm truncate ${thread.unreadCount > 0 ? "text-white" : "text-gray-300"}`}>
                                                {thread.leadName}
                                            </h3>
                                        </div>
                                        <span className="text-[10px] text-text-muted whitespace-nowrap ml-2">
                                            {thread.lastMessageAt && formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false })}
                                        </span>
                                    </div>

                                    <p className={`text-xs line-clamp-2 leading-relaxed ${thread.unreadCount > 0 ? "text-gray-300" : "text-gray-500"}`}>
                                        {thread.lastMessage}
                                    </p>

                                    <div className="mt-3 flex items-center gap-2">
                                        {thread.platform === "LINKEDIN" ? (
                                            <Badge variant="info" className="py-0 px-1.5 h-5 text-[9px]">LinkedIn</Badge>
                                        ) : (
                                            <Badge variant="default" className="py-0 px-1.5 h-5 text-[9px] bg-white/5 text-text-secondary border-none">Email</Badge>
                                        )}
                                        <span className="text-[10px] text-text-muted truncate max-w-[100px]">{thread.leadDetails?.company}</span>

                                        {/* 2025 Feature: Sentiment Badge */}
                                        <Badge
                                            variant={
                                                thread.sentiment === "POSITIVE" ? "success" :
                                                    thread.sentiment === "NEGATIVE" ? "danger" : "default"
                                            }
                                            className="ml-auto text-[9px] h-5 py-0 px-2 uppercase tracking-wide opacity-80"
                                        >
                                            {thread.sentiment || "Neutral"}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. Conversation View */}
                <div className="flex-1 bg-black/40 flex flex-col relative">
                    {selectedThreadId ? (
                        <ConversationView threadId={selectedThreadId} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary space-y-4">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

function FolderItem({ label, icon: Icon, active, count, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${active
                ? "bg-accent-blue/10 text-accent-blue shadow-glow"
                : "text-text-secondary hover:text-white hover:bg-white/5"
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${active ? "text-accent-blue" : "text-text-muted group-hover:text-white"}`} />
                {label}
            </div>
            {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? "bg-accent-blue text-white" : "bg-white/10 text-white"
                    }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function ConversationView({ threadId }: { threadId: string }) {
    // Note: In a real app we'd fetch specific messages, but our mock service returns messages directly on the thread object or via a separate call.
    // Here let's assume valid mock messages are returned for the demo.
    const { data, isLoading } = useSWR(`/api/inbox/${threadId}`, fetcher);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Get messages from API response
    const messages = data?.messages || [];

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [threadId, messages]);

    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleSend = async () => {
        if (!reply.trim()) return;
        setSending(true);

        const promise = new Promise<void>((resolve, reject) => {
            undoTimerRef.current = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/inbox/${threadId}/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: reply })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to send message');
                    }

                    // Success handling
                    setReply("");
                    setSending(false);
                    mutate(`/api/inbox/${threadId}`);
                    resolve();
                } catch (error: any) {
                    setSending(false);
                    reject(error);
                }
            }, 5000); // 5 second delay
        });

        toast.promise(promise, {
            loading: (
                <div className="flex items-center justify-between w-full gap-4">
                    <span>Sending in 5s...</span>
                    <button
                        onClick={() => {
                            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                            setSending(false);
                            toast.dismiss();
                            toast.info("Message cancelled");
                        }}
                        className="px-2 py-1 bg-white/20 rounded text-xs font-bold hover:bg-white/30"
                    >
                        UNDO
                    </button>
                </div>
            ),
            success: "Message sent",
            error: "Failed to send"
        });
    };

    if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent-blue" /></div>;

    const lead = data?.lead || { fullName: "Unknown User", company: "Unknown Co", jobTitle: "Prospect" };

    return (
        <>
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01] backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {lead.fullName?.[0]}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            {lead.fullName}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-text-muted font-normal uppercase tracking-wider">{lead.jobTitle}</span>
                        </h3>
                        <div className="text-xs text-text-secondary flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {lead.company}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition">
                        <User className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth" ref={scrollRef}>
                {messages.map((msg: any, i: number) => (
                    <div key={i} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"} animate-slide-up`}>
                        <div className={`max-w-[70%] group flex flex-col ${msg.sender === "me" ? "items-end" : "items-start"}`}>
                            <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm relative ${msg.sender === "me"
                                ? "bg-accent-blue text-white rounded-tr-sm"
                                : "bg-white/10 text-gray-100 border border-white/5 rounded-tl-sm backdrop-blur-sm"
                                }`}>
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-text-muted mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-xl">
                <div className="relative group rounded-2xl bg-white/5 border border-white/10 focus-within:border-accent-blue/50 focus-within:bg-white/[0.07] transition-all duration-300">
                    <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder={`Reply to ${lead.fullName.split(' ')[0]}...`}
                        className="w-full bg-transparent border-none rounded-2xl p-4 pr-32 text-sm text-white focus:ring-0 resize-none h-[100px] placeholder:text-text-muted/50"
                    />

                    {/* Floating Toolbar */}
                    <div className="absolute bottom-3 left-3 flex gap-2">
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition" title="Attach file">
                            <Reply className="w-4 h-4 rotate-180" />
                        </button>
                        <button className="p-1.5 hover:bg-purple-500/20 rounded-lg text-purple-400 transition" title="AI Assist">
                            <Sparkles className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="absolute bottom-3 right-3">
                        <button
                            onClick={handleSend}
                            disabled={sending || !reply.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-xs font-bold rounded-xl hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {sending ? "Sending..." : "Send"}
                        </button>
                    </div>
                </div>
                <div className="mt-2 text-center">
                    <span className="text-[10px] text-text-muted font-medium">Press <kbd className="font-mono bg-white/10 px-1 rounded">Enter</kbd> to send</span>
                </div>
            </div>
        </>
    );
}
