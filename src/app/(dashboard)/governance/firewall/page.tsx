"use client";

import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { ShieldAlert, EyeOff, Activity, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FirewallPage() {
    return (
        <GovernanceLayout>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    label="Firewall Status"
                    value="Active"
                    icon={ShieldAlert}
                    description="Monitoring all outbound LLM traffic"
                    trend={{ value: 100, isUp: true }}
                />
                <StatCard
                    label="PII Entities Redacted"
                    value="1,240"
                    icon={EyeOff}
                    description="Last 24 hours"
                    trend={{ value: 12, isUp: true }}
                />
                <StatCard
                    label="Requests Scrubbed"
                    value="856"
                    icon={RefreshCw}
                    description="Total filtered prompts"
                />
                <StatCard
                    label="Data Sovereignty"
                    value="100%"
                    icon={Activity}
                    description="No PII leakage detected"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <Card title="Traffic Inspector" subtitle="Real-time PII redaction stream">
                    <div className="space-y-4">
                        {[
                            { time: "2m ago", type: "EMAIL", source: "Campaign Gen", status: "Redacted" },
                            { time: "5m ago", type: "PHONE", source: "Lead Note", status: "Redacted" },
                            { time: "12m ago", type: "CREDIT_CARD", source: "Chat Widget", status: "Blocked" },
                            { time: "18m ago", type: "SSN", source: "Document Analysis", status: "Redacted" },
                        ].map((event, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="bg-red-500/10 p-2 rounded-lg text-red-400">
                                        <EyeOff className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white">{event.type} Detected</h4>
                                        <p className="text-xs text-text-secondary">{event.source} • {event.time}</p>
                                    </div>
                                </div>
                                <Badge variant="danger">{event.status}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Top Redacted Entities" subtitle="Most frequent PII types encountered">
                    <div className="space-y-6 mt-2">
                        {[
                            { label: "Email Addresses", count: 850, percent: 68 },
                            { label: "Phone Numbers", count: 240, percent: 19 },
                            { label: "Credit Cards", count: 110, percent: 9 },
                            { label: "SSN / Tax IDs", count: 40, percent: 4 },
                        ].map((item, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-white">{item.label}</span>
                                    <span className="text-sm text-text-secondary">{item.count}</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent-blue rounded-full"
                                        style={{ width: `${item.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </GovernanceLayout>
    );
}
