"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Download, Star, Bot, Zap, BookOpen } from 'lucide-react';

export default function MarketplacePage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetch(process.env.NEXT_PUBLIC_API_URL + "/marketplace")
            .then(res => res.json())
            .then(data => {
                setTemplates(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleInstall = async (templateId: string, type: string) => {
        const toastId = toast.loading("Installing...");
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            toast.dismiss(toastId);
            toast.success("Installed successfully!");

            if (type === 'WORKFLOW' || type === 'AGENT') {
                router.push(`/workflows/${data.id}`);
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e.message || "Installation failed");
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'AGENT': return <Bot className="w-4 h-4 text-purple-400" />;
            case 'WORKFLOW': return <Zap className="w-4 h-4 text-blue-400" />;
            case 'PLAYBOOK': return <BookOpen className="w-4 h-4 text-green-400" />;
            default: return <Star className="w-4 h-4 text-yellow-400" />;
        }
    };

    if (loading) return <div className="p-8">Loading marketplace...</div>;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <SectionHeader
                title="Agent Marketplace"
                subtitle="Discover pre-built agents, workflows, and growth playbooks"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((tpl) => (
                    <GlassCard key={tpl.id} className="flex flex-col h-full hover:border-blue-500/50 transition-colors">
                        <div className="p-6 flex-1 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                                    {getTypeIcon(tpl.type)}
                                </div>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 flex items-center gap-1">
                                    {tpl.type}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">{tpl.name}</h3>
                                <p className="text-sm text-gray-400 line-clamp-2">{tpl.description}</p>
                            </div>

                            {tpl.metrics && (
                                <div className="p-3 bg-white/5 rounded-lg text-xs space-y-1">
                                    <div className="text-gray-500 font-medium uppercase tracking-wider">Performance</div>
                                    <div className="flex gap-4 text-white">
                                        {Object.entries(tpl.metrics).map(([k, v]: any) => (
                                            <span key={k}>{k}: <span className="text-green-400">{v}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/20">
                            <div className="text-xs text-gray-500">
                                by {tpl.author || "ConvoSpan"}
                            </div>
                            <button
                                onClick={() => handleInstall(tpl.id, tpl.type)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Install
                            </button>
                        </div>
                    </GlassCard>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="inline-block p-4 rounded-full bg-white/5 border border-white/10">
                            <Bot className="w-12 h-12 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">No items found</h3>
                            <p className="text-gray-500">The marketplace is currently empty. Run the seed script to populate.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
