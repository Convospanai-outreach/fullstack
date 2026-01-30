"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface Lead {
    id: string;
    fullName: string;
    company: string;
    jobTitle: string;
    location: string;
    linkedIn: string;
    email?: string;
    status: string;
    campaign?: { name: string };
    isEnriched?: boolean;
    enrichedData?: any;
}

interface LeadDetailProps {
    lead: Lead;
}

export function LeadDetail({ lead: initialLead }: LeadDetailProps) {
    const [lead, setLead] = useState(initialLead);
    const [loading, setLoading] = useState(false);

    const handleAction = async (action: string) => {
        setLoading(true);
        try {
            await fetch(`/api/leads/${lead.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            alert(`Action ${action} triggered!`);
        } catch (error) {
            console.error("Failed to trigger action", error);
            alert("Failed to trigger action");
        } finally {
            setLoading(false);
        }
    };

    const handleEnrich = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/leads/${lead.id}/enrich`, {
                method: "POST"
            });
            const data = await res.json();
            if (data.success) {
                setLead(prev => ({ ...prev, isEnriched: true, enrichedData: data.data }));
            }
        } catch (error) {
            console.error("Failed to enrich lead", error);
        } finally {
            setLoading(false);
        }
    };

    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        setIsOffline(!navigator.onLine);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="space-y-6">
            {isOffline && (
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-200 p-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <WifiOff className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">
                        You are currently offline. Enrichment data may not load and actions will be queued.
                    </p>
                </div>
            )}
            <div className="flex justify-between items-start">
                <SectionHeader
                    title={lead.fullName}
                    subtitle={`${lead.jobTitle} at ${lead.company}`}
                />
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.open(lead.linkedIn, "_blank")}>
                        View on LinkedIn
                    </Button>
                    <Button variant="outline" onClick={handleEnrich} disabled={loading || lead.isEnriched || isOffline}>
                        {lead.isEnriched ? "Enriched" : "Enrich Data"}
                    </Button>
                    <Button variant="default" onClick={() => handleAction("CONNECT")} disabled={loading || isOffline}>
                        Connect Now
                    </Button>
                    <Button variant="outline" onClick={() => handleAction("MESSAGE")} disabled={loading || isOffline}>
                        Send Message
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                    <GlassCard className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Profile Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-white/60">Location</p>
                                <p className="text-white">{lead.location || "Unknown"}</p>
                            </div>
                            <div>
                                <p className="text-white/60">Email</p>
                                <p className="text-white">{lead.email || "—"}</p>
                            </div>
                            <div>
                                <p className="text-white/60">Status</p>
                                <Badge variant={lead.status === "CONNECTED" ? "success" : "default"}>
                                    {lead.status}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-white/60">Campaign</p>
                                <p className="text-white">{lead.campaign?.name || "None"}</p>
                            </div>
                        </div>
                    </GlassCard>

                    {lead.isEnriched && lead.enrichedData && (
                        <GlassCard className="space-y-4 border-purple-500/30">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-lg font-semibold gradient-text">Enriched Insights</h3>
                                <Badge variant="success">AI Verified</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-6 text-sm">
                                <div>
                                    <p className="text-white/60 mb-1">Company Size</p>
                                    <p className="text-white font-medium">{lead.enrichedData.company_size}</p>
                                </div>
                                <div>
                                    <p className="text-white/60 mb-1">Revenue</p>
                                    <p className="text-white font-medium">{lead.enrichedData.revenue}</p>
                                </div>
                                <div>
                                    <p className="text-white/60 mb-1">Industry</p>
                                    <p className="text-white font-medium">{lead.enrichedData.industry}</p>
                                </div>
                                <div>
                                    <p className="text-white/60 mb-1">Tech Stack</p>
                                    <div className="flex flex-wrap gap-1">
                                        {lead.enrichedData.technologies?.map((tech: string) => (
                                            <span key={tech} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    )}
                </div>

                <GlassCard>
                    <h3 className="text-lg font-semibold text-white mb-4">Activity Log</h3>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                            <div>
                                <p className="text-white text-sm">Lead Created</p>
                                <p className="text-white/40 text-xs">Just now</p>
                            </div>
                        </div>
                        {lead.isEnriched && (
                            <div className="flex gap-3">
                                <div className="w-2 h-2 mt-2 rounded-full bg-purple-500"></div>
                                <div>
                                    <p className="text-white text-sm">Data Enriched</p>
                                    <p className="text-white/40 text-xs">Just now</p>
                                </div>
                            </div>
                        )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
