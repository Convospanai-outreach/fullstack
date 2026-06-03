import { redirect as nextRedirect } from "next/navigation";
import { checkAdmin } from "@/lib/admin";
import Link from "next/link";
import { FileText, Plus, ArrowLeft, RefreshCw, Edit3, Globe } from "lucide-react";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

export default async function CMSDashboard() {
    const isAdmin = await checkAdmin();
    if (!isAdmin) {
        nextRedirect("/");
    }

    // Call local endpoint or load directory directly
    let files: string[] = [];
    try {
        const { listContentFiles } = await import("@/lib/cms");
        files = listContentFiles();
    } catch (err) {
        console.error("Failed to load content files on server:", err);
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white pt-24 px-6 md:px-12 pb-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <div className="flex items-center gap-2 text-purple-400 mb-2">
                            <Globe size={18} />
                            <span className="text-sm font-semibold tracking-wider uppercase">Content Management</span>
                        </div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                            Git-Based CMS
                        </h1>
                        <p className="text-slate-400 mt-2">
                            Manage and publish static front-end pages directly inside your Git repository.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/cms/edit"
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2.5 rounded-xl transition duration-200 neo-shadow"
                        >
                            <Plus size={16} />
                            <span>Create File</span>
                        </Link>
                    </div>
                </div>

                {/* Content Files List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {files.length > 0 ? (
                        files.map((file) => (
                            <Link key={file} href={`/admin/cms/edit?file=${encodeURIComponent(file)}`} className="group">
                                <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/60 transition duration-300 flex flex-col justify-between h-44 cursor-pointer relative overflow-hidden group neo-shadow">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-300" />
                                    
                                    <div>
                                        <div className="flex items-center gap-3 text-purple-300 mb-3">
                                            <FileText size={22} className="group-hover:scale-110 transition duration-300" />
                                            <span className="text-xs font-semibold tracking-widest uppercase bg-purple-950/80 px-2.5 py-1 rounded-md border border-purple-800/40">
                                                {file.split("/")[0] || "root"}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-lg text-white group-hover:text-purple-300 transition duration-200 truncate">
                                            {file.split("/").slice(1).join("/") || file}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 truncate">
                                            path: content/{file}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-400 mt-4 border-t border-slate-900 pt-3">
                                        <span className="font-mono text-[10px] text-slate-500">
                                            markdown
                                        </span>
                                        <span className="flex items-center gap-1 group-hover:text-purple-400 transition duration-200">
                                            <Edit3 size={12} />
                                            Edit File
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="col-span-full">
                            <GlassCard>
                                <div className="text-center py-10">
                                    <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-300 mb-1">No Files Found</h3>
                                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                                        Create your first markdown file in the content directory to begin managing frontend copy.
                                    </p>
                                    <Link
                                        href="/admin/cms/edit"
                                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition duration-200"
                                    >
                                        <Plus size={16} />
                                        <span>Create a File</span>
                                    </Link>
                                </div>
                            </GlassCard>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
