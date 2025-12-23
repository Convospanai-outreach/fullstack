"use client";

import { useState, useEffect } from "react";
import {
    Database,
    Plus,
    Upload,
    Link as LinkIcon,
    Search,
    Trash2,
    FileText,
    Loader2,
    Globe,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function KnowledgePage() {
    const [kbs, setKbs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedKb, setSelectedKb] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newKbName, setNewKbName] = useState("");
    const [newKbDesc, setNewKbDesc] = useState("");
    const [ingestType, setIngestType] = useState<"URL" | "FILE" | null>(null);
    const [url, setUrl] = useState("");
    const [isIngesting, setIsIngesting] = useState(false);

    useEffect(() => {
        fetchKbs();
    }, []);

    useEffect(() => {
        if (selectedKb) {
            fetchItems(selectedKb.id);
        }
    }, [selectedKb]);

    const fetchKbs = async () => {
        try {
            const res = await fetch("/api/knowledge");
            const data = await res.json();
            setKbs(data);
        } catch (e) {
            toast.error("Failed to load knowledge bases");
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async (id: string) => {
        setItemsLoading(true);
        try {
            const res = await fetch(`/api/knowledge/${id}`);
            const data = await res.json();
            setItems(data);
        } catch (e) {
            toast.error("Failed to load items");
        } finally {
            setItemsLoading(false);
        }
    };

    const createKb = async () => {
        if (!newKbName) return;
        try {
            const res = await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKbName, description: newKbDesc })
            });
            if (res.ok) {
                toast.success("Knowledge Base created");
                setIsCreating(false);
                setNewKbName("");
                setNewKbDesc("");
                fetchKbs();
            }
        } catch (e) {
            toast.error("Error creating knowledge base");
        }
    };

    const deleteKb = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure? This will delete all indexed items.")) return;
        try {
            const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Deleted successfully");
                if (selectedKb?.id === id) setSelectedKb(null);
                fetchKbs();
            }
        } catch (e) {
            toast.error("Error deleting knowledge base");
        }
    };

    const handleIngest = async () => {
        if (!selectedKb) return;
        setIsIngesting(true);
        try {
            const res = await fetch(`/api/knowledge/${selectedKb.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ingestType === "URL" ? { type: "URL", url } : {
                    type: "FILE",
                    fileName: "product_doc.pdf",
                    content: "Simulated text content from PDF file..."
                })
            });
            if (res.ok) {
                toast.success("Ingestion started successfully");
                setIngestType(null);
                setUrl("");
                fetchItems(selectedKb.id);
            }
        } catch (e) {
            toast.error("Ingestion failed");
        } finally {
            setIsIngesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Knowledge Base</h1>
                    <p className="text-gray-400 mt-1">Train your AI agents with custom documents and URLs.</p>
                </div>
                {!selectedKb && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> New Collection
                    </button>
                )}
            </div>

            {!selectedKb ? (
                /* KB Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {kbs.map((kb) => (
                        <div
                            key={kb.id}
                            onClick={() => setSelectedKb(kb)}
                            className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-blue-500/30 cursor-pointer transition-all hover:translate-y-[-4px] group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center">
                                    <Database className="w-6 h-6 text-blue-400" />
                                </div>
                                <button
                                    onClick={(e) => deleteKb(kb.id, e)}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{kb.name}</h3>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{kb.description || "No description provided."}</p>
                            <div className="mt-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                                <span className="text-blue-400">{kb._count?.items || 0} chunks indexed</span>
                                <span className="text-gray-500">{formatDistanceToNow(new Date(kb.createdAt))} ago</span>
                            </div>
                        </div>
                    ))}
                    {kbs.length === 0 && !isCreating && (
                        <div className="col-span-full py-20 text-center glass-panel rounded-3xl border border-dashed border-white/10">
                            <Database className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-20" />
                            <h3 className="text-xl font-bold text-gray-400">No knowledge bases yet</h3>
                            <p className="text-gray-500 mt-2 max-w-sm mx-auto">Create a collection to start grounding your AI agents with specific industry knowledge.</p>
                        </div>
                    )}
                </div>
            ) : (
                /* Detail View */
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedKb(null)}
                            className="p-2 glass-panel rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{selectedKb.name}</h2>
                            <p className="text-sm text-gray-400">{selectedKb.description}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Summary & Ingestion */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Manage Sources</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => setIngestType("URL")}
                                        className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left group"
                                    >
                                        <Globe className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                                        <div>
                                            <div className="text-sm font-semibold text-white">Import URL</div>
                                            <div className="text-[11px] text-gray-500">Scrape web pages and docs</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIngestType("FILE")}
                                        className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left group"
                                    >
                                        <Upload className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                                        <div>
                                            <div className="text-sm font-semibold text-white">Upload File</div>
                                            <div className="text-[11px] text-gray-500">PDF, Docx, or TXT</div>
                                        </div>
                                    </button>
                                </div>

                                {ingestType === "URL" && (
                                    <div className="pt-4 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-gray-400">Website URL</label>
                                        <div className="relative">
                                            <input
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                placeholder="https://docs.example.com"
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={isIngesting || !url}
                                                onClick={handleIngest}
                                                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-blue-500 disabled:opacity-50"
                                            >
                                                {isIngesting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Start Indexing"}
                                            </button>
                                            <button onClick={() => setIngestType(null)} className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold text-gray-400 font-bold hover:bg-white/10 transition">Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {ingestType === "FILE" && (
                                    <div className="pt-4 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-gray-400">Upload PDF/DOC</label>
                                        <div className="group border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-all cursor-pointer">
                                            <Upload className="w-8 h-8 text-gray-600 mx-auto mb-3 group-hover:text-blue-500 transition-colors" />
                                            <span className="text-xs text-gray-500">Select file (Simulated)</span>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                disabled={isIngesting}
                                                onClick={handleIngest}
                                                className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-50"
                                            >
                                                Index File
                                            </button>
                                            <button onClick={() => setIngestType(null)} className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold text-gray-400 font-bold hover:bg-white/10 transition">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Indexed Items</h3>
                                <div className="text-[11px] font-bold text-blue-400 bg-blue-600/10 px-2 py-1 rounded-md">{items.length} Chunks</div>
                            </div>

                            {itemsLoading ? (
                                <div className="flex items-center justify-center h-64 glass-panel rounded-2xl border border-white/10">
                                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="glass-panel p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                                        >
                                            <div className="flex gap-4">
                                                <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.metadata?.type === 'URL' ? 'bg-blue-600/10' : 'bg-purple-600/10'}`}>
                                                    {item.metadata?.type === 'URL' ? <Globe className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-purple-400" />}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">{item.content}</p>
                                                    <div className="flex items-center gap-3 pt-2 text-[10px] font-bold text-gray-500">
                                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Vector Indexed</span>
                                                        <span>•</span>
                                                        <span className="truncate max-w-[200px]">{item.metadata?.source || "Direct Text"}</span>
                                                        <span>•</span>
                                                        <span>{formatDistanceToNow(new Date(item.createdAt))} ago</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <div className="py-20 text-center glass-panel rounded-2xl border border-white/10 opacity-60">
                                            <Search className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-gray-500">No items indexed in this collection yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-white mb-2">New Knowledge Base</h2>
                        <p className="text-sm text-gray-400 mb-6">Create a logical grouping for your specialized data.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Collection Name</label>
                                <input
                                    value={newKbName}
                                    onChange={(e) => setNewKbName(e.target.value)}
                                    placeholder="e.g. Q4 Sales Playbook"
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Brief Description</label>
                                <textarea
                                    value={newKbDesc}
                                    onChange={(e) => setNewKbDesc(e.target.value)}
                                    placeholder="What knowledge does this collection contain?"
                                    rows={3}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={createKb}
                                className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/40"
                            >
                                Create Collection
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="flex-1 bg-white/5 text-gray-400 rounded-xl py-3 font-bold hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
