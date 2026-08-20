"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/workflows");
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
            const res = await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/workflows/${id}`, {
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
                <div>
                    <h1 className="text-3xl font-bold text-white">Automations</h1>
                    <p className="text-gray-400">Manage your event-based workflows</p>
                </div>
                <div className="flex space-x-3">
                    <Link href="/automations/approvals" className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors">
                        Approvals Queue
                    </Link>
                    <Link href="/workflows" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        New Automation
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="glass border border-white/10 rounded-xl p-8 text-center">
                    <div className="animate-pulse text-gray-400">Loading automations...</div>
                </div>
            ) : automations.length === 0 ? (
                <div className="glass border border-white/10 rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center mb-4">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <h3 className="text-lg font-medium text-white">No active automations</h3>
                    <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        Create rules like "When a lead replies, stop the campaign" or "When email opens, tag as Warm".
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {automations.map((automation) => (
                        <div key={automation.id} className="glass border border-white/10 rounded-xl p-6 hover:border-white/20 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-white">{automation.name}</h3>
                                        {automation.isActive ? (
                                            <span className="px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-full">
                                                Paused
                                            </span>
                                        )}
                                        {automation.requiresApproval && (
                                            <span className="px-2 py-1 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
                                                Requires Approval
                                            </span>
                                        )}
                                    </div>
                                    {automation.description && (
                                        <p className="text-gray-400 text-sm mb-3">{automation.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500">Trigger:</span>
                                            <span className="text-blue-400">{getTriggerLabel(automation.trigger)}</span>
                                        </div>
                                        <span className="text-gray-600">→</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500">Action:</span>
                                            <span className="text-purple-400">{getActionLabel(automation.action)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleAutomation(automation.id, automation.isActive)}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${automation.isActive
                                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20"
                                                : "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                                            }`}
                                    >
                                        {automation.isActive ? "Pause" : "Activate"}
                                    </button>
                                    <Link
                                        href={`/workflows/${automation.id}`}
                                        className="px-3 py-1.5 text-sm bg-white/5 text-gray-300 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
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
