"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Users, Building, DollarSign, Smile, Meh, Frown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface LeadIntelligenceSidebarProps {
    threadId: string;
}

export function LeadIntelligenceSidebar({ threadId }: LeadIntelligenceSidebarProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (!threadId) return;
        let isMounted = true;
        setLoading(true);

        const fetchAnalysis = async () => {
            try {
                const threadRes = await fetch(getBrowserApiBase() + `/inbox/${threadId}`);
                if (!threadRes.ok) throw new Error("Failed to load thread");
                const threadData = await threadRes.json();
                const rawMessages = Array.isArray(threadData?.messages) ? threadData.messages : [];
                const mappedMessages = rawMessages.map((msg: any) => ({
                    role: (msg.direction || msg.sender) === "INBOUND" || msg.sender === "them" ? "user" : "assistant",
                    content: msg.content
                })).filter((msg: any) => msg.content);

                if (!mappedMessages.length) {
                    throw new Error("No messages to analyze");
                }

                const res = await fetch(getBrowserApiBase() + "/agents/inbox/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: mappedMessages, leadId: threadId })
                });

                if (!res.ok) throw new Error("Analysis failed");

                const result = await res.json();
                if (isMounted) setData(result);
            } catch (e) {
                console.error("Analysis failed", e);
                if (isMounted) toast.error("Failed to analyze conversation");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAnalysis();

        return () => { isMounted = false; };
    }, [threadId]);

    if (loading) return (
        <div className="h-full p-6 border-l border-foreground/10 flex flex-col items-center justify-center text-foreground/40">
            <Sparkles className="w-6 h-6 animate-pulse mb-2" />
            <span className="text-sm">Analyzing conversation...</span>
        </div>
    );

    if (!data) return null;

    return (
        <div className="h-full border-l border-foreground/10 bg-foreground/20 p-6 overflow-y-auto space-y-6">

            {/* AI Summary Card */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Insight</span>
                </div>
                <GlassCard className="p-4 bg-gradient-to-br from-primary/10 to-primary/10 border-foreground/10">
                    <p className="text-sm text-foreground/80 leading-relaxed">
                        {data.summary}
                    </p>
                    <div className="mt-3 pt-3 border-t border-foreground/10 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Sentiment</span>
                        <div className="flex items-center gap-2">
                            {data.sentiment === 'positive' && <Smile className="w-4 h-4 text-success" />}
                            {data.sentiment === 'neutral' && <Meh className="w-4 h-4 text-warning" />}
                            {data.sentiment === 'negative' && <Frown className="w-4 h-4 text-destructive" />}
                            <span className={`text-xs font-bold ${data.sentiment === 'positive' ? "text-success" :
                                data.sentiment === 'neutral' ? "text-warning" : "text-destructive"
                                }`}>
                                {data.sentimentScore}/100
                            </span>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Next Best Action */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suggested Action</label>
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
                    {data.nextBestAction}
                </div>
            </div>

            {/* CRM Data */}
            <div className="space-y-4 pt-4 border-t border-foreground/10">
                <h3 className="text-sm font-semibold text-foreground">Lead Details</h3>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center text-foreground font-bold">
                        {data.lead.name.charAt(0)}
                    </div>
                    <div>
                        <div className="text-foreground font-medium">{data.lead.name}</div>
                        <div className="text-xs text-muted-foreground">{data.lead.role}</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-foreground/80">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span>{data.lead.company}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-foreground/80">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{data.lead.size} employees</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-foreground/80">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>{data.lead.revenue}</span>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-foreground/10">
                <button className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-foreground/20 rounded-lg hover:bg-foreground/5">
                    + Add Private Note
                </button>
            </div>

        </div>
    );
}
