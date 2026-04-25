"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Check, X, Edit, Zap, Eye } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";

export default function CommandCenterPage() {
    const [drafts, setDrafts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDrafts = async () => {
        try {
            const res = await fetch(API_BASE + '/agent/outreach/drafts');
            if (res.ok) {
                const data = await res.json();
                setDrafts(data);
            }
        } catch (e) {
            toast.error("Failed to load agent drafts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const handleApprove = async (id: string, region: string) => {
        try {
            const promise = fetch(API_BASE + '/agent/outreach/approve', {
                method: 'POST',
                body: JSON.stringify({ id, region })
            });

            toast.promise(promise, {
                loading: 'Agent engaging...',
                success: 'Outreach Sent! (Strike executed)',
                error: 'Failed to send'
            });

            await promise;
            setDrafts(prev => prev.filter(d => d.id !== id));
        } catch (e) {
            // Error handled by toast
        }
    };

    const handleReject = async (id: string, region: string) => {
        try {
            await fetch(API_BASE + '/agent/outreach/approve', {
                method: 'POST',
                body: JSON.stringify({ id, region, action: 'REJECT' })
            });
            setDrafts(prev => prev.filter(d => d.id !== id));
            toast.info("Draft rejected");
        } catch (e) {
            toast.error("Rejection failed");
        }
    };

    const handleReveal = async (draftId: string, originalLeadId: string) => {
        try {
            const res = await fetch(`${API_BASE}/leads/${originalLeadId}/identity`);
            const data = await res.json();

            if (data.email) {
                toast.success(`Identity Revealed: ${data.email}`);
                // Update specific draft with revealed info
                setDrafts(prev => prev.map(d => {
                    if (d.id === draftId) {
                        return {
                            ...d,
                            isMasked: false,
                            lead: data.name || d.lead,
                            // Append revealed details to message for context or tooltip?
                            // For now just update the name visual
                        };
                    }
                    return d;
                }));
            } else {
                toast.warning("No PII found in vault");
            }
        } catch (e) {
            toast.error("Identity Vault Access Denied");
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <SectionHeader
                title="Command Center"
                subtitle="Human-in-the-Loop (HITL) Oversight for Autonomous Agents."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Pending Approvals Column */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Edit className="w-5 h-5 text-blue-400" />
                        Pending Approvals
                        <Badge variant="secondary" className="ml-2">{drafts.length}</Badge>
                    </h3>

                    {loading ? (
                        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
                    ) : (
                        <div className="space-y-4">
                            {drafts.map(draft => (
                                <GlassCard key={draft.id} className="p-6 border-l-4 border-l-yellow-500">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-lg text-white">
                                                {draft.lead}
                                                {draft.isMasked && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleReveal(draft.id, draft.originalId)} className="ml-2 h-6 text-xs text-yellow-400">
                                                        <Eye className="w-3 h-3 mr-1" /> Reveal
                                                    </Button>
                                                )}
                                            </h4>
                                            <p className="text-sm text-gray-400">{draft.company}</p>
                                        </div>
                                        <Badge variant={draft.score > 80 ? "destructive" : "default"}>
                                            Score: {draft.score}
                                        </Badge>
                                    </div>

                                    <div className="bg-black/30 p-4 rounded-xl mb-4 text-gray-300 font-mono text-sm border border-white/10">
                                        "{draft.message}"
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <Button variant="outline" size="sm" onClick={() => handleReject(draft.id, draft.region)} className="text-red-400 hover:text-red-300">
                                            <X className="w-4 h-4 mr-1" /> Reject
                                        </Button>
                                        <Button variant="default" size="sm" onClick={() => handleApprove(draft.id, draft.region)} className="bg-green-600 hover:bg-green-500">
                                            <Check className="w-4 h-4 mr-1" /> Approve & Strike
                                        </Button>
                                    </div>
                                </GlassCard>
                            ))}
                            {drafts.length === 0 && (
                                <p className="text-gray-500 italic">No pending drafts. Agents are idle.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Agent Status Column */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Active Agents
                    </h3>

                    <GlassCard className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-300">Outreach Agent</span>
                            <Badge variant="success" className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                            Last Strike: 2m ago<br />
                            Queue: {drafts.length} items
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6 space-y-4 border-l-4 border-l-red-500">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-300">Sentinel (Quality)</span>
                            <Badge variant="destructive" className="bg-red-500/10 text-red-400">High Alert</Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                            Blocked: 3 attempts<br />
                            Threat Level: MODERATE
                        </div>
                    </GlassCard>
                </div>

            </div>
        </div>
    );
}
