'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Database, CheckCircle2, Globe, FileText } from 'lucide-react';

export default function KnowledgeBaseManager() {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleSimulatedUpload = () => {
        setIsUploading(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsUploading(false);
                    return 100;
                }
                return prev + 5;
            });
        }, 100);
    };

    return (
        <GlassCard className="border-none bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                            Knowledge Engine
                        </div>
                        <div className="text-gray-400 text-sm">
                            Train your AI agents with proprietary data and industry knowledge.
                        </div>
                    </div>
                    <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1">
                        V2.0 Grounding Enabled
                    </Badge>
                </div>
            </div>

            <div className="p-6 pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KnowledgeSourceCard
                        icon={<Upload className="w-5 h-5" />}
                        title="File Upload"
                        desc="PDF, CSV, TXT"
                        isActive={!isUploading}
                        onClick={handleSimulatedUpload}
                    />
                    <KnowledgeSourceCard
                        icon={<Globe className="w-5 h-5" />}
                        title="URL Scraper"
                        desc="Import Website"
                        isActive={!isUploading}
                    />
                    <KnowledgeSourceCard
                        icon={<Database className="w-5 h-5" />}
                        title="Direct Input"
                        desc="Custom Snippets"
                        isActive={!isUploading}
                    />
                </div>

                {isUploading && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                Vectorizing & Indexing into PostgreSQL...
                            </span>
                            <span className="font-medium text-white">{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Active Modules</h4>
                    <div className="space-y-2">
                        <ActiveKnowledgeItem
                            title="2024 Product Roadmap.pdf"
                            type="Document"
                            date="2 mins ago"
                            chunks={14}
                        />
                        <ActiveKnowledgeItem
                            title="https://docs.craftmyfunnel.ai/pricing"
                            type="Web"
                            date="1 hour ago"
                            chunks={32}
                        />
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}

function KnowledgeSourceCard({ icon, title, desc, isActive, onClick }: any) {
    return (
        <button
            onClick={onClick}
            disabled={!isActive}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                {icon}
            </div>
            <h5 className="mt-3 font-semibold text-white">{title}</h5>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
        </button>
    );
}

function ActiveKnowledgeItem({ title, type, date, chunks }: any) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-all group">
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-gray-500/10 text-gray-400">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        {type} • {chunks} Chunks • Indexed {date}
                    </div>
                </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/50" />
        </div>
    );
}
