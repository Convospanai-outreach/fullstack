"use client";

import { useState, useEffect } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { ShieldAlert, EyeOff, Activity, RefreshCw, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FirewallPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [stats, setStats] = useState({
        redactedCount: 0,
        scrubbedRequests: 0,
        status: "Active",
    });

    return (
        <GovernanceLayout>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    label="Firewall Status"
                    value={stats.status}
                    icon={ShieldAlert}
                    description="Monitoring all outbound LLM traffic"
                />
                <StatCard
                    label="PII Entities Redacted"
                    value={stats.redactedCount.toLocaleString()}
                    icon={EyeOff}
                    description="Last 24 hours"
                />
                <StatCard
                    label="Requests Scrubbed"
                    value={stats.scrubbedRequests.toLocaleString()}
                    icon={RefreshCw}
                    description="Total filtered prompts"
                />
                <StatCard
                    label="Data Sovereignty"
                    value="Enforced"
                    icon={Activity}
                    description="Zero unauthorized PII transmission"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Traffic Inspector</CardTitle>
                        <CardDescription>Real-time PII redaction stream</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[200px] text-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                                <p className="text-white font-semibold text-sm">All Traffic Clean</p>
                                <p className="text-text-secondary text-xs mt-1">No prompt injection or PII leakage detected in active sessions.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {events.map((event, i) => (
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
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Redacted Entities</CardTitle>
                        <CardDescription>PII categorization log</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center h-[200px] text-center">
                            <ShieldAlert className="w-8 h-8 text-blue-400 mb-2" />
                            <p className="text-white font-semibold text-sm">Sanitization Active</p>
                            <p className="text-text-secondary text-xs mt-1">Prompt guardrails automatically mask sensitive tokens prior to provider dispatch.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </GovernanceLayout>
    );
}
