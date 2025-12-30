"use client";

import { useEffect, useState, useRef } from "react";
import {
    Search,
    Zap,
    Users,
    Megaphone,
    Workflow,
    Database,
    ArrowRight,
    Command,
    Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SearchResults {
    leads: any[];
    campaigns: any[];
    workflows: any[];
    knowledge: any[];
}

export function Omnibox() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
            setQuery("");
            setResults(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch();
            } else {
                setResults(null);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                setResults(data.data);
                setSelectedIndex(0);
            }
        } catch (error) {
            console.error("Search failed", error);
            toast.error("Global search is currently unavailable. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { label: "Create Campaign", icon: Megaphone, color: "text-purple-400", href: "/campaigns/new" },
        { label: "Add Lead", icon: Users, color: "text-blue-400", href: "/leads/new" },
        { label: "Configure Workflow", icon: Workflow, color: "text-emerald-400", href: "/workflows" },
        { label: "Knowledge Base", icon: Database, color: "text-amber-400", href: "/knowledge" },
    ];

    const flattenedResults = [
        ...(results?.leads.map(l => ({ ...l, type: "Lead", icon: Users })) || []),
        ...(results?.campaigns.map(c => ({ ...c, type: "Campaign", icon: Megaphone })) || []),
        ...(results?.workflows.map(w => ({ ...w, type: "Workflow", icon: Workflow })) || []),
        ...(results?.knowledge.map(k => ({ ...k, type: "Knowledge", icon: Database })) || []),
    ];

    const handleSelect = (item: any) => {
        setIsOpen(false);
        if (item.href) {
            router.push(item.href);
        } else {
            // Mapping to routes
            const routes: Record<string, string> = {
                "Lead": "/leads",
                "Campaign": "/campaigns",
                "Workflow": "/workflows",
                "Knowledge": "/knowledge"
            };
            router.push(`${routes[item.type]}/${item.id}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Search Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
                    <Search className="w-5 h-5 text-gray-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search anything or run a command..."
                        className="flex-1 bg-transparent border-none text-white focus:outline-none text-lg placeholder:text-gray-600"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {loading ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded border border-white/10">
                            <Command className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-400">K</span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                    {query.length === 0 ? (
                        <div className="py-4">
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Quick Actions</div>
                            <div className="grid grid-cols-2 gap-2 p-2">
                                {quickActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelect(action)}
                                        className="flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                                    >
                                        <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}>
                                            <action.icon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left font-semibold text-sm text-gray-300 group-hover:text-white transition-colors">{action.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {flattenedResults.length > 0 ? (
                                <>
                                    <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Search Results</div>
                                    {flattenedResults.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelect(item)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${selectedIndex === idx ? "bg-blue-600/20 border-blue-500/30" : "hover:bg-white/5 border-transparent"
                                                } border group`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors`}>
                                                    <item.icon className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-white">{item.name || item.fullName || item.content?.substring(0, 40)}</div>
                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5 uppercase font-bold tracking-tighter">
                                                        {item.type} {item.company && `• ${item.company}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className={`w-4 h-4 text-gray-600 transition-all ${selectedIndex === idx ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`} />
                                        </button>
                                    ))}
                                </>
                            ) : !loading && (
                                <div className="py-12 text-center">
                                    <Zap className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                                    <div className="text-gray-400 font-medium">No direct matches found</div>
                                    <button
                                        className="text-blue-500 text-sm font-bold mt-2 hover:underline"
                                        onClick={() => {
                                            toast.info("AI RAG Search triggered...");
                                            handleSelect({ href: `/knowledge?q=${query}` });
                                        }}
                                    >
                                        Ask AI Search instead?
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold">
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-white/10 rounded text-gray-400">↑↓</span> Move</div>
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-white/10 rounded text-gray-400">Enter</span> Select</div>
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-white/10 rounded text-gray-400">Esc</span> Close</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

