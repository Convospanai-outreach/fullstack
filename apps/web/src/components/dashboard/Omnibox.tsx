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
    Loader2,
    LayoutDashboard,
    Inbox,
    Activity,
    ShieldCheck,
    CreditCard,
    Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HIDDEN_FEATURES } from "@/lib/productFlags";

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
            const res = await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/search/global?q=${encodeURIComponent(query)}`);
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

    // Static pages + tools — jump-to navigation, no network round-trip needed.
    const staticPages = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Leads", href: "/leads", icon: Users },
        { name: "Campaigns", href: "/campaigns", icon: Megaphone },
        { name: "Inbox", href: "/inbox", icon: Inbox },
        { name: "Intel", href: "/intel", icon: Activity },
        { name: "Governance", href: "/governance", icon: ShieldCheck },
        { name: "Billing", href: "/billing", icon: CreditCard },
        { name: "CRM", href: "/crm", icon: Activity },
        { name: "Tools", href: "/tools", icon: Wrench },
    ];
    const staticTools = Object.values(HIDDEN_FEATURES)
        .filter((f) => f.built)
        .map((f) => ({ name: f.label, href: f.openPath, icon: Wrench }));

    const staticMatches = (() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return [...staticPages, ...staticTools]
            .filter((item) => item.name.toLowerCase().includes(q))
            .map((item) => ({ ...item, type: "Page" }));
    })();

    const flattenedResults = [
        ...(results?.leads.map(l => ({ ...l, type: "Lead", icon: Users })) || []),
        ...(results?.campaigns.map(c => ({ ...c, type: "Campaign", icon: Megaphone })) || []),
        ...(results?.workflows.map(w => ({ ...w, type: "Workflow", icon: Workflow })) || []),
        ...(results?.knowledge.map(k => ({ ...k, type: "Knowledge", icon: Database })) || []),
        ...staticMatches,
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Search Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                    <Search className="w-5 h-5 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search anything or run a command..."
                        className="flex-1 bg-transparent border-none text-foreground focus:outline-none text-lg placeholder:text-muted-foreground"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {loading ? (
                        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded border border-border">
                            <Command className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-muted-foreground">K</span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                    {query.length === 0 ? (
                        <div className="py-4">
                            <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quick Actions</div>
                            <div className="grid grid-cols-2 gap-2 p-2">
                                {quickActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelect(action)}
                                        className="flex items-center gap-3 p-4 rounded-xl hover:bg-accent border border-transparent transition-all group"
                                    >
                                        <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}>
                                            <action.icon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left font-semibold text-sm text-foreground transition-colors">{action.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {flattenedResults.length > 0 ? (
                                <>
                                    <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Search Results</div>
                                    {flattenedResults.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelect(item)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${selectedIndex === idx ? "bg-brand-500/10 border-brand-500/30" : "hover:bg-accent border-transparent"
                                                } border group`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-brand-500 transition-colors`}>
                                                    <item.icon className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-foreground">{item.name || item.fullName || item.content?.substring(0, 40)}</div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold tracking-tighter">
                                                        {item.type} {item.company && `• ${item.company}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className={`w-4 h-4 text-muted-foreground transition-all ${selectedIndex === idx ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`} />
                                        </button>
                                    ))}
                                </>
                            ) : !loading && (
                                <div className="py-12 text-center">
                                    <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <div className="text-muted-foreground font-medium">No direct matches found</div>
                                    <button
                                        className="text-brand-500 text-sm font-bold mt-2 hover:underline"
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
                <div className="px-6 py-3 bg-muted/50 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold">
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-background rounded border border-border">↑↓</span> Move</div>
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-background rounded border border-border">Enter</span> Select</div>
                        <div className="flex items-center gap-1.5"><span className="px-1 py-0.5 bg-background rounded border border-border">Esc</span> Close</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

