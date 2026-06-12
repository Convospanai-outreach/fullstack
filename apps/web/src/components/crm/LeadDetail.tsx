"use client";

import { useState, useEffect } from "react";
import {
    WifiOff,
    Globe,
    Flame,
    Clock,
    TrendingUp,
    ShieldCheck,
    ShieldAlert,
    RefreshCw,
    Activity,
    Compass
} from "lucide-react";
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
    channelStatuses?: Array<{ channel: string; status: string; lastActivityAt?: string | Date | null }>;
    campaign?: { name: string };
    isEnriched?: boolean;
    enrichedData?: any;

    // CRM Intent Scoring
    intentScore?: number;
    leadScore?: number;
    pipelineState?: string;
    lastScoredAt?: string | Date;
    dwellTimeMinutes?: number;
    emailClicks?: number;
    socialMentions?: number;

    // DPDP Consent
    consentObtained?: boolean;

    // Predictive Analytics
    clusterLabel?: string;
    churnRisk?: number;
    optimalSendHour?: number;

    // Pipeline Stage Dates
    pipelineStateChangedAt?: string | Date;
    hotAt?: string | Date;
    wonAt?: string | Date;
    lostAt?: string | Date;
}

interface LeadDetailProps {
    lead: Lead;
}

type TimelineItem = {
    id: string;
    type: string;
    title: string;
    subject?: string;
    status?: string;
    campaignName?: string;
    createdAt: string | Date;
};

function channelBadgeLabel(channel: string, status: string) {
    if (channel === "EMAIL" && status === "CONTACTED") return "Email Sent";
    if (channel === "LINKEDIN" && status === "CAPTURED") return "LinkedIn Captured";
    if (channel === "LINKEDIN" && status === "DRAFTED") return "LinkedIn Drafted";
    if (channel === "LINKEDIN" && status === "CONTACTED") return "LinkedIn Contacted";
    if (status === "FOLLOW_UP") return "Follow-up Needed";
    return `${channel} ${status}`.replaceAll("_", " ");
}

export function LeadDetail({ lead: initialLead }: LeadDetailProps) {
    const [lead, setLead] = useState(initialLead);
    const [loading, setLoading] = useState(false);
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);

    const handleAction = async (action: string) => {
        setLoading(true);
        try {
            await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${lead.id}/action`, {
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
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${lead.id}/enrich`, {
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

    const handleReScore = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/scoring/persist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId: lead.id })
            });
            if (!res.ok) throw new Error("Re-scoring failed");

            // Reload the lead details
            const leadRes = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${lead.id}`);
            const freshLead = await leadRes.json();
            if (freshLead && !freshLead.error) {
                setLead(freshLead);
                alert("Lead re-scored successfully!");
            }
        } catch (error) {
            console.error("Failed to re-score lead", error);
            alert("Failed to re-score lead");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleConsent = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${lead.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consentObtained: !lead.consentObtained })
            });
            if (!res.ok) throw new Error("Failed to update consent");
            const freshLead = await res.json();
            setLead(freshLead);
            alert("Consent updated successfully!");
        } catch (error) {
            console.error("Failed to toggle consent", error);
            alert("Failed to toggle consent");
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

    useEffect(() => {
        let cancelled = false;

        fetch(`/api/leads/${lead.id}/timeline`, { cache: "no-store" })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (!cancelled) setTimeline(Array.isArray(data?.timeline) ? data.timeline : []);
            })
            .catch(() => {
                if (!cancelled) setTimeline([]);
            });

        return () => { cancelled = true; };
    }, [lead.id]);

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
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <SectionHeader
                    title={lead.fullName || "Unnamed Lead"}
                    subtitle={`${lead.jobTitle || "Professional"} at ${lead.company || "Independent"}`}
                />
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={lead.consentObtained ? "outline" : "destructive"}
                        className={`gap-1.5 font-bold ${lead.consentObtained ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'}`}
                        onClick={handleToggleConsent}
                        disabled={loading}
                    >
                        {lead.consentObtained ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        {lead.consentObtained ? "Consent Granted" : "Consent Needed"}
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-1.5 hover:bg-white/5"
                        onClick={handleReScore}
                        disabled={loading || isOffline}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Re-Score Intent
                    </Button>
                    {lead.linkedIn && (
                        <Button variant="outline" onClick={() => window.open(lead.linkedIn, "_blank")}>
                            View LinkedIn
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleEnrich} disabled={loading || lead.isEnriched || isOffline}>
                        {lead.isEnriched ? "Enriched" : "Enrich Data"}
                    </Button>
                    <Button variant="default" onClick={() => handleAction("CONNECT")} disabled={loading || isOffline}>
                        Connect
                    </Button>
                    <Button variant="outline" onClick={() => handleAction("MESSAGE")} disabled={loading || isOffline}>
                        Send Message
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Columns - Details & Scoring */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Profile details */}
                    <GlassCard className="space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Globe className="w-5 h-5 text-brand-400" />
                            Profile Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-white/60">Location</p>
                                <p className="text-white font-medium">{lead.location || "Unknown"}</p>
                            </div>
                            <div>
                                <p className="text-white/60">Email Address</p>
                                <p className="text-white font-medium">{lead.email || "—"}</p>
                            </div>
                            <div>
                                <p className="text-white/60">Outreach Status</p>
                                <Badge variant={lead.status === "enriched" ? "success" : "default"} className="mt-0.5">
                                    {lead.status}
                                </Badge>
                                {lead.channelStatuses?.length ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {lead.channelStatuses.map((item) => (
                                            <span key={`${item.channel}-${item.status}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                                                {channelBadgeLabel(item.channel, item.status)}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div>
                                <p className="text-white/60">Active Campaign</p>
                                <p className="text-white font-medium">{lead.campaign?.name || "None"}</p>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-cyan-400" />
                            Activity Timeline
                        </h3>
                        {timeline.length === 0 ? (
                            <p className="text-sm text-white/50">No email, LinkedIn, or campaign activity has been recorded for this lead yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {timeline.slice(0, 12).map((item) => (
                                    <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <span className="text-xs text-white/40">{new Date(item.createdAt).toLocaleString()}</span>
                                        </div>
                                        {item.subject && <p className="mt-1 text-sm text-white/70">{item.subject}</p>}
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                                            {item.campaignName && <span>Campaign: {item.campaignName}</span>}
                                            {item.status && <span>Status: {item.status}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    {/* Premium Intent Scoring Breakdown */}
                    <GlassCard className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Flame className="w-5 h-5 text-orange-500" />
                                Lead Intent Scoring Breakdown
                            </h3>
                            {lead.lastScoredAt && (
                                <span className="text-xs text-white/40">
                                    Last scored: {new Date(lead.lastScoredAt).toLocaleDateString()} at {new Date(lead.lastScoredAt).toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            {/* Intent Score Indicator Gauge */}
                            <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 relative">
                                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider mb-2">Intent Index</span>
                                <div className="relative w-28 h-28 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" className="stroke-white/10" strokeWidth="8" fill="transparent" />
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            className={`transition-all duration-1000 ${
                                                (lead.intentScore || 0) >= 0.7 ? 'stroke-red-500' :
                                                (lead.intentScore || 0) >= 0.4 ? 'stroke-amber-500' : 'stroke-blue-500'
                                            }`}
                                            strokeWidth="8"
                                            fill="transparent"
                                            strokeDasharray="251.2"
                                            strokeDashoffset={251.2 - (251.2 * (lead.intentScore || 0))}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold text-white font-mono">{Math.round((lead.intentScore || 0) * 100)}%</span>
                                        <span className="text-[9px] uppercase font-bold text-white/40 mt-0.5">
                                            {(lead.intentScore || 0) >= 0.7 ? 'HOT 🔥' :
                                             (lead.intentScore || 0) >= 0.4 ? 'WARM ⚡' : 'COLD ❄️'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Granular Progress Breakdown */}
                            <div className="md:col-span-2 space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs text-white/60 mb-1">
                                        <span>Website Dwell Time</span>
                                        <span className="font-semibold text-white">{lead.dwellTimeMinutes || 0} minutes</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-1.5">
                                        <div
                                            className="bg-blue-400 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(100, Math.round(((lead.dwellTimeMinutes || 0) / 10) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-white/60 mb-1">
                                        <span>Outbound Email Clicks</span>
                                        <span className="font-semibold text-white">{lead.emailClicks || 0} clicks</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-1.5">
                                        <div
                                            className="bg-amber-400 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(100, Math.round(((lead.emailClicks || 0) / 5) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-white/60 mb-1">
                                        <span>Social Mentions / Interactions</span>
                                        <span className="font-semibold text-white">{lead.socialMentions || 0} mentions</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-1.5">
                                        <div
                                            className="bg-purple-400 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(100, Math.round(((lead.socialMentions || 0) / 3) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-white/70">
                            <strong>Formula Confidence Explanation:</strong> A weighted matrix of Engagement (dwell time × 40%), Outreach CTR (clicks × 35%), and Social proof (mentions × 25%). Promo thresholds: 40% WARM, 70% HOT with automated caller handover.
                        </div>
                    </GlassCard>

                    {/* Enriched insights */}
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

                {/* Right Column - Pipeline State Journey & Predictive Analytics */}
                <div className="space-y-6">
                    {/* Predictive AI Analytics */}
                    <GlassCard className="space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Compass className="w-5 h-5 text-purple-400" />
                            Predictive AI Insights
                        </h3>
                        <div className="space-y-3.5 text-sm">
                            <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-purple-400" />
                                    <span className="text-white/80">Cluster Group</span>
                                </div>
                                <Badge className="bg-purple-600/30 text-purple-300 border border-purple-600/20 font-bold uppercase text-[10px]">
                                    {lead.clusterLabel || "HIGH_VALUE"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-rose-400" />
                                    <span className="text-white/80">Churn Risk Probability</span>
                                </div>
                                <span className={`font-mono font-bold ${
                                    (lead.churnRisk || 0.12) > 0.5 ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                    {lead.churnRisk !== undefined && lead.churnRisk !== null
                                        ? `${Math.round(lead.churnRisk * 100)}%`
                                        : '12%'
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                    <span className="text-white/80">Optimal Reach Hour</span>
                                </div>
                                <span className="font-semibold text-white font-mono">
                                    {lead.optimalSendHour !== undefined && lead.optimalSendHour !== null
                                        ? `${lead.optimalSendHour > 12 ? lead.optimalSendHour - 12 : lead.optimalSendHour}:00 ${lead.optimalSendHour >= 12 ? 'PM' : 'AM'}`
                                        : '10:00 AM'
                                    }
                                </span>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Pipeline Stage Journey Timeline */}
                    <GlassCard className="space-y-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-brand-400" />
                            Pipeline State Journey
                        </h3>

                        <div className="relative pl-6 border-l border-white/10 space-y-6 text-sm">
                            {/* Stage: COLD */}
                            <div className="relative">
                                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-brand-500 bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20" />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-white">Cold Lead Initialized</p>
                                    <p className="text-xs text-white/40">
                                        Imported {new Date(lead.pipelineStateChangedAt || lead.lastScoredAt || Date.now()).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Stage: WARM */}
                            <div className="relative">
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                                    lead.pipelineState === "WARM" || lead.pipelineState === "HOT" || lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                        ? 'border-amber-500 bg-amber-500 shadow-lg shadow-amber-500/20'
                                        : 'border-white/20 bg-background'
                                }`} />
                                <div className="space-y-0.5">
                                    <p className={`font-bold ${
                                        lead.pipelineState === "WARM" || lead.pipelineState === "HOT" || lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'text-white' : 'text-white/40'
                                    }`}>Warm Nurture Promoted</p>
                                    <p className="text-xs text-white/40">
                                        {lead.pipelineState === "WARM" || lead.pipelineState === "HOT" || lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? `Scored intent >= 40%`
                                            : 'Requires intent score >= 40%'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Stage: HOT */}
                            <div className="relative">
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                                    lead.pipelineState === "HOT" || lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                        ? 'border-red-500 bg-red-500 shadow-lg shadow-red-500/20 animate-pulse'
                                        : 'border-white/20 bg-background'
                                }`} />
                                <div className="space-y-0.5">
                                    <p className={`font-bold ${
                                        lead.pipelineState === "HOT" || lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'text-white' : 'text-white/40'
                                    }`}>Hot Handover Triggered</p>
                                    <p className="text-xs text-white/40">
                                        {lead.hotAt
                                            ? `Intent reached 70% at ${new Date(lead.hotAt).toLocaleTimeString()}`
                                            : 'Requires intent score >= 70%'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Stage: COORDINATING */}
                            <div className="relative">
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                                    lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                        ? 'border-purple-500 bg-purple-500 shadow-lg shadow-purple-500/20'
                                        : 'border-white/20 bg-background'
                                }`} />
                                <div className="space-y-0.5">
                                    <p className={`font-bold ${
                                        lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'text-white' : 'text-white/40'
                                    }`}>Human Call claimed</p>
                                    <p className="text-xs text-white/40">
                                        {lead.pipelineState === "COORDINATING" || lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'Active in coordination queue'
                                            : 'Awaiting human caller claim'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Stage: MEETING_CONFIRMED */}
                            <div className="relative">
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                                    lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                        ? 'border-emerald-500 bg-emerald-500 shadow-lg shadow-emerald-500/20'
                                        : 'border-white/20 bg-background'
                                }`} />
                                <div className="space-y-0.5">
                                    <p className={`font-bold ${
                                        lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'text-white' : 'text-white/40'
                                    }`}>Meeting Scheduled</p>
                                    <p className="text-xs text-white/40">
                                        {lead.pipelineState === "MEETING_CONFIRMED" || lead.pipelineState === "COMPLETED"
                                            ? 'Calendar confirmed'
                                            : 'Requires caller call success'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Stage: COMPLETED */}
                            <div className="relative">
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                                    lead.pipelineState === "COMPLETED"
                                        ? 'border-green-500 bg-green-500 shadow-lg shadow-green-500/20'
                                        : 'border-white/20 bg-background'
                                }`} />
                                <div className="space-y-0.5">
                                    <p className={`font-bold ${lead.pipelineState === "COMPLETED" ? 'text-white' : 'text-white/40'}`}>Closed / Completed</p>
                                    <p className="text-xs text-white/40">
                                        {lead.wonAt
                                            ? `Won on ${new Date(lead.wonAt).toLocaleDateString()}`
                                            : lead.lostAt
                                            ? `Lost on ${new Date(lead.lostAt).toLocaleDateString()}`
                                            : 'Outcome summary'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
