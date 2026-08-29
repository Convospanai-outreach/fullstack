"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface Automation {
    id: string;
    name: string;
    description: string | null;
    trigger: string;
    action: string;
    isActive: boolean;
    requiresApproval: boolean;
    createdAt: string;
}

export default function AutomationsPage() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAutomations();
    }, []);

    const fetchAutomations = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/workflows");
            if (!res.ok) throw new Error("Failed to fetch automations");
            const data = await res.json();
            setAutomations(data);
        } catch (error) {
            toast.error("Failed to load automations");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAutomation = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`${getBrowserApiBase()}/workflows/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (!res.ok) throw new Error("Failed to update automation");
            toast.success(currentStatus ? "Automation paused" : "Automation activated");
            fetchAutomations();
        } catch (error) {
            toast.error("Failed to update automation");
        }
    };

    const getTriggerLabel = (trigger: string) => {
        const labels: Record<string, string> = {
            "lead.replied": "Lead Replies",
            "email.opened": "Email Opens",
            "ai.suggestion": "AI Suggestion"
        };
        return labels[trigger] || trigger;
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            "campaign.stop": "Stop Campaign",
            "email.reply": "Send Reply",
            "lead.tag": "Tag Lead",
            "webhook.call": "Call Webhook"
        };
        return labels[action] || action;
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <SectionHeader title="Automations" subtitle="Manage your event-based workflows" />
                <div className="flex space-x-3">
                    <Link href="/automations/approvals" className="px-4 py-2 bg-warning/10 text-warning border border-warning/20 rounded-lg hover:bg-warning/20 transition-colors">
                        Approvals Queue
                    </Link>
                    <Link href="/workflows" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        New Automation
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="glass border border-border rounded-xl p-8 text-center">
                    <div className="animate-pulse text-muted-foreground">Loading automations...</div>
                </div>
            ) : automations.length === 0 ? (
                <div className="glass border border-border rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center mb-4">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <h3 className="text-lg font-medium text-foreground">No active automations</h3>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        Create rules like "When a lead replies, stop the campaign" or "When email opens, tag as Warm".
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {automations.map((automation) => (
                        <div key={automation.id} className="glass border border-border rounded-xl p-6 hover:border-border transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-foreground">{automation.name}</h3>
                                        {automation.isActive ? (
                                            <span className="px-2 py-1 text-xs bg-success/10 text-success border border-success/20 rounded-full">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs bg-muted text-muted-foreground border border-border rounded-full">
                                                Paused
                                            </span>
                                        )}
                                        {automation.requiresApproval && (
                                            <span className="px-2 py-1 text-xs bg-warning/10 text-warning border border-warning/20 rounded-full">
                                                Requires Approval
                                            </span>
                                        )}
                                    </div>
                                    {automation.description && (
                                        <p className="text-muted-foreground text-sm mb-3">{automation.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Trigger:</span>
                                            <span className="text-primary">{getTriggerLabel(automation.trigger)}</span>
                                        </div>
                                        <span className="text-muted-foreground">→</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Action:</span>
                                            <span className="text-purple-400">{getActionLabel(automation.action)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleAutomation(automation.id, automation.isActive)}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${automation.isActive
                                                ? "bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20"
                                                : "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                                            }`}
                                    >
                                        {automation.isActive ? "Pause" : "Activate"}
                                    </button>
                                    <Link
                                        href={`/workflows/${automation.id}`}
                                        className="px-3 py-1.5 text-sm bg-muted text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                                    >
                                        Edit
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
