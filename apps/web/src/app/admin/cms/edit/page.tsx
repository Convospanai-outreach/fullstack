"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, Eye, Edit, Columns, FileCode } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

function CMSEditorContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileParam = searchParams.get("file") || "";

    const [file, setFile] = useState(fileParam);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(!!fileParam);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");

    // Load file content if file is specified in URL
    useEffect(() => {
        if (!fileParam) return;

        async function fetchFile() {
            try {
                const res = await fetch(`/api/admin/cms?file=${encodeURIComponent(fileParam)}`);
                if (!res.ok) {
                    throw new Error("Failed to load file contents");
                }
                const data = await res.json();
                setContent(data.content || "");
            } catch (err: any) {
                toast.error(err.message || "Error loading file");
            } finally {
                setLoading(false);
            }
        }

        fetchFile();
    }, [fileParam]);

    // Handle Save
    const handleSave = async () => {
        if (!file) {
            toast.error("Please specify a filename");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/admin/cms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file, content }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save file");
            }

            toast.success("File saved locally");
            if (!fileParam) {
                router.push(`/admin/cms/edit?file=${encodeURIComponent(file)}`);
            }
        } catch (err: any) {
            toast.error(err.message || "Error saving file");
        } finally {
            setSaving(false);
        }
    };

    // Handle Git Commit & Sync
    const handleGitSync = async () => {
        if (!file) {
            toast.error("Please specify a filename first");
            return;
        }

        // Save first
        setSyncing(true);
        try {
            // Ensure local changes are saved first
            const saveRes = await fetch("/api/admin/cms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file, content }),
            });
            if (!saveRes.ok) throw new Error("Failed to save changes before sync");

            // Perform git commit and push
            const res = await fetch("/api/admin/cms", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Git sync failed");
            }

            toast.success("Successfully pushed to GitHub!");
        } catch (err: any) {
            toast.error(err.message || "Error syncing with GitHub");
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-purple-400" size={36} />
                    <p className="text-slate-400 text-sm">Loading content file...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white pt-20 flex flex-col h-screen">
            {/* Editor Top Bar */}
            <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <Link
                        href="/admin/cms"
                        className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition duration-200"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    
                    <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <span className="text-slate-500 font-mono text-sm self-center">content/</span>
                        <input
                            type="text"
                            placeholder="e.g. faq/general.md"
                            value={file}
                            onChange={(e) => setFile(e.target.value)}
                            disabled={!!fileParam}
                            className="bg-slate-950 border border-slate-800 focus:border-purple-500/50 outline-none text-white font-mono text-sm px-3.5 py-2 rounded-xl flex-1 max-w-md disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                    {/* View Switcher (Desktop Only) */}
                    <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 mr-2">
                        <button
                            onClick={() => setViewMode("edit")}
                            className={`p-2 rounded-lg transition duration-200 ${viewMode === "edit" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                            title="Editor Only"
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("split")}
                            className={`p-2 rounded-lg transition duration-200 ${viewMode === "split" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                            title="Split Screen"
                        >
                            <Columns size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("preview")}
                            className={`p-2 rounded-lg transition duration-200 ${viewMode === "preview" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                            title="Preview Only"
                        >
                            <Eye size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>Save Local</span>
                    </button>

                    <button
                        onClick={handleGitSync}
                        disabled={syncing}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-medium transition duration-200 neo-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        <span>Push to Git</span>
                    </button>
                </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Editor Section */}
                {(viewMode === "edit" || viewMode === "split") && (
                    <div className="flex-1 h-full flex flex-col border-r border-slate-900 bg-slate-950 p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-2">
                            <FileCode size={14} />
                            <span>MARKDOWN SOURCE</span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="flex-1 w-full bg-slate-900/40 border border-slate-800/80 focus:border-purple-500/30 outline-none p-4 rounded-xl text-slate-100 font-mono text-sm resize-none focus:ring-0 leading-relaxed overflow-y-auto"
                            placeholder="Write your markdown here... Use --- for frontmatter"
                        />
                    </div>
                )}

                {/* Preview Section */}
                {(viewMode === "preview" || viewMode === "split") && (
                    <div className="flex-1 h-full flex flex-col bg-slate-900/10 p-4 overflow-y-auto">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-2">
                            <Eye size={14} />
                            <span>LIVE PREVIEW</span>
                        </div>
                        <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-xl p-6 overflow-y-auto">
                            <div className="prose prose-invert max-w-none text-slate-300">
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CMSEditorPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="animate-spin text-purple-400" size={36} />
                        <p className="text-slate-400 text-sm">Preparing CMS Editor...</p>
                    </div>
                </div>
            }
        >
            <CMSEditorContent />
        </Suspense>
    );
}
