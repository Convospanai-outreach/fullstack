"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
    Search,
    Filter,
    Mail,
    Linkedin as LinkedinIcon,
    CheckCircle,
    Clock,
    ChevronRight,
    Sparkles,
    Send,
    User,
    Building2,
    Calendar,
    Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InboxPage() {
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [platformFilter, setPlatformFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const queryUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.append("status", statusFilter);
        if (platformFilter !== "ALL") params.append("platform", platformFilter);
        if (debouncedSearch) params.append("search", debouncedSearch);
        return `/api/inbox?${params.toString()}`;
    }, [statusFilter, platformFilter, debouncedSearch]);

    const { data: conversations, error, isLoading } = useSWR(queryUrl, fetcher, {
        refreshInterval: 10000,
        revalidateOnFocus: true
    });

    return (
        <div className="flex h-[calc(100vh-100px)] glass border border-white/10 rounded-2xl overflow-hidden animate-in fade-in duration-500">
            {/* Sidebar List */}
            <div className="w-1/3 border-r border-white/10 flex flex-col bg-black/20">
                <div className="p-4 border-b border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Inbox</h2>
                        <span className="text-[10px] uppercase tracking-widest text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded">Unified</span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search leads or companies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar">
                        <FilterButton
                            active={statusFilter === "ALL"}
                            onClick={() => setStatusFilter("ALL")}
                            label="All"
                        />
                        <FilterButton
                            active={statusFilter === "UNREAD"}
                            onClick={() => setStatusFilter("UNREAD")}
                            label="Unread"
                            badge={conversations?.filter((c: any) => !c.isRead).length}
                        />
                        <select
                            value={platformFilter}
                            onChange={(e) => setPlatformFilter(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-400 focus:outline-none outline-none"
                        >
                            <option value="ALL">All Platforms</option>
                            <option value="EMAIL">Email Only</option>
                            <option value="LINKEDIN">LinkedIn Only</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {conversations?.map((conv: any) => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedLeadId(conv.id)}
                            className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition group relative ${selectedLeadId === conv.id ? "bg-white/10" : ""
                                }`}
                        >
                            {selectedLeadId === conv.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                            )}

                            <div className="flex justify-between items-start mb-1">
                                <h3 className={`font-semibold text-sm truncate max-w-[160px] ${!conv.isRead ? "text-white" : "text-gray-300"}`}>
                                    {conv.name}
                                </h3>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-gray-500 font-medium">
                                        {formatDistanceToNow(new Date(conv.lastMessageAt || Date.now()), { addSuffix: true })}
                                    </span>
                                    {conv.unreadCount > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-purple-600 text-[10px] flex items-center justify-center text-white font-bold">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                {conv.leadDetails?.linkedIn ? (
                                    <LinkedinIcon className="w-3 h-3 text-blue-400" />
                                ) : (
                                    <Mail className="w-3 h-3 text-purple-400" />
                                )}
                                <span className="truncate">{conv.leadDetails?.company || "Independent"}</span>
                            </div>

                            <p className={`text-xs line-clamp-2 ${!conv.isRead ? "text-gray-200 font-medium" : "text-gray-500"}`}>
                                {conv.lastMessage}
                            </p>

                            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="p-8 text-center space-y-4">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="w-12 h-12 bg-white/5 rounded-full mb-4" />
                                <div className="h-4 w-32 bg-white/5 rounded mb-2" />
                                <div className="h-3 w-24 bg-white/5 rounded" />
                            </div>
                        </div>
                    )}

                    {!isLoading && conversations?.length === 0 && (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4">
                            <div className="p-4 rounded-full bg-white/5">
                                <Search className="w-8 h-8 opacity-20" />
                            </div>
                            <div className="text-sm px-4">No conversations match your current filters.</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-black/40">
                {selectedLeadId ? (
                    <ChatView leadId={selectedLeadId} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                            <Mail className="w-12 h-12 opacity-20" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-white font-medium">Select a conversation</h3>
                            <p className="text-sm">Start chatting with your leads instantly</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterButton({ active, onClick, label, badge }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap
                ${active
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
        >
            {label}
            {badge > 0 && (
                <span className={`px-1.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-purple-600 text-white"}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

function ChatView({ leadId }: { leadId: string }) {
    const { data, error, isLoading } = useSWR(`/api/inbox/${leadId}`, fetcher, { refreshInterval: 5000 });
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [data]);

    const [generating, setGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const handleSend = async (overrideContent?: string) => {
        const content = overrideContent || reply;
        if (!content.trim()) return;
        setSending(true);
        try {
            await fetch("/api/inbox/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, content, platform: data?.lead?.linkedIn ? "LINKEDIN" : "EMAIL" }),
            });
            if (!overrideContent) setReply("");
            mutate(`/api/inbox/${leadId}`);
            mutate((key: string) => typeof key === 'string' && key.startsWith('/api/inbox'));
            toast.success("Reply sent!");
        } catch (e) {
            toast.error("Failed to send");
        } finally {
            setSending(false);
        }
    };

    const handleAiSuggest = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/api/inbox/suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId })
            });

            const json = await res.json();
            if (json.error) throw new Error(json.error);

            setSuggestions(json.suggestions || []);
            toast.success("AI suggested replies ready!");
        } catch (e: any) {
            toast.error(e.message || "AI failed to generate suggestions");
        } finally {
            setGenerating(false);
        }
    };

    if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse">Loading conversation...</div>;

    return (
        <>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-white font-bold">
                        {data.lead.fullName?.[0] || "?"}
                    </div>
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            {data.lead.fullName}
                            {data.lead.linkedIn && <LinkedinIcon className="w-3 h-3 text-blue-400" />}
                        </h3>
                        <div className="text-[10px] text-gray-500 flex items-center gap-2">
                            <Building2 className="w-3 h-3" /> {data.lead.company}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                        <Calendar className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                        <User className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
                {data.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[80%] flex flex-col gap-1">
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.direction === "OUTBOUND"
                                ? "bg-purple-600 text-white rounded-tr-none"
                                : "bg-white/5 text-gray-200 border border-white/10 rounded-tl-none"
                                }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] text-gray-500 ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                                {msg.direction === "OUTBOUND" && (
                                    <CheckCircle className={`w-3 h-3 ${msg.status === 'sent' ? 'text-green-500' : 'text-gray-600'}`} />
                                )}
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {data.messages?.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full gap-4">
                        <Clock className="w-12 h-12 opacity-10" />
                        <p className="text-sm">No message history yet.</p>
                    </div>
                )}
            </div>

            {/* AI Suggestions Carousel */}
            {suggestions.length > 0 && (
                <div className="px-4 py-3 bg-purple-500/5 border-t border-white/5 flex gap-2 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-2">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setReply(s);
                                setSuggestions([]);
                            }}
                            className="flex-shrink-0 bg-white/5 hover:bg-purple-500/20 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-300 transition-all max-w-[200px] truncate"
                        >
                            {s}
                        </button>
                    ))}
                    <button
                        onClick={() => setSuggestions([])}
                        className="text-[10px] text-gray-600 hover:text-gray-400 underline p-2"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-xl">
                <div className="relative group">
                    <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Write your message..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pr-32 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all resize-none h-[100px] shadow-inner"
                    />
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <button
                            onClick={handleAiSuggest}
                            disabled={generating}
                            className={`p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-xl transition-all ${generating ? "animate-pulse" : ""}`}
                            title="Generate AI suggestions"
                        >
                            <Sparkles className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="absolute bottom-4 right-4">
                        <button
                            onClick={() => handleSend()}
                            disabled={sending || !reply.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-purple-900/40"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send
                        </button>
                    </div>
                </div>
                <div className="mt-2 px-1 flex justify-between items-center">
                    <span className="text-[10px] text-gray-600">Press Enter to send, Shift+Enter for new line</span>
                    <div className="flex gap-2 text-[10px] text-gray-600">
                        <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Email</span>
                        <span className="flex items-center gap-1"><LinkedinIcon className="w-2.5 h-2.5" /> LinkedIn</span>
                    </div>
                </div>
            </div>
        </>
    );
}
