"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Download, Star, Bot, Zap, BookOpen } from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function MarketplacePage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const router = useRouter();

    const fetchTemplates = () => {
        setLoading(true);
        setLoadError(false);
        fetch(getBrowserApiBase() + "/marketplace")
            .then(res => {
                if (!res.ok) throw new Error("Failed to load marketplace");
                return res.json();
            })
            .then(data => {
                setTemplates(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoadError(true);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleInstall = async (templateId: string, type: string) => {
        const toastId = toast.loading("Installing...");
        try {
            const res = await fetch(getBrowserApiBase() + "/marketplace/install", {
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
            case 'PLAYBOOK': return <BookOpen className="w-4 h-4 text-success" />;
            default: return <Star className="w-4 h-4 text-yellow-400" />;
        }
    };

    if (loading) return <div className="p-8">Loading marketplace...</div>;
    if (loadError) {
        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto">
                <SectionHeader
                    title="Agent Marketplace"
                    subtitle="Discover pre-built agents, workflows, and growth playbooks"
                />
                <div className="py-20 text-center space-y-4">
                    <p className="text-destructive">Couldn't load the marketplace.</p>
                    <button onClick={fetchTemplates} className="px-4 py-2 bg-muted hover:bg-accent text-foreground text-sm font-medium rounded-lg transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <SectionHeader
                title="Agent Marketplace"
                subtitle="Discover pre-built agents, workflows, and growth playbooks"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((tpl) => (
                    <GlassCard key={tpl.id} className="flex flex-col h-full hover:border-primary/50 transition-colors">
                        <div className="p-6 flex-1 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-border">
                                    {getTypeIcon(tpl.type)}
                                </div>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted border border-border flex items-center gap-1">
                                    {tpl.type}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">{tpl.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{tpl.description}</p>
                            </div>

                            {tpl.metrics && (
                                <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                                    <div className="text-muted-foreground font-medium uppercase tracking-wider">Performance</div>
                                    <div className="flex gap-4 text-foreground">
                                        {Object.entries(tpl.metrics).map(([k, v]: any) => (
                                            <span key={k}>{k}: <span className="text-success">{v}</span></span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-border flex justify-between items-center bg-background">
                            <div className="text-xs text-muted-foreground">
                                by {tpl.author || "CraftMyFunnel"}
                            </div>
                            <button
                                onClick={() => handleInstall(tpl.id, tpl.type)}
                                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent text-foreground text-sm font-medium rounded-lg transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Install
                            </button>
                        </div>
                    </GlassCard>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="inline-block p-4 rounded-full bg-muted border border-border">
                            <Bot className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-foreground">No items available yet</h3>
                            <p className="text-muted-foreground">Check back soon — pre-built agents, workflows, and playbooks will appear here.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
