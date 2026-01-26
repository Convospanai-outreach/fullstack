"use client";

import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Activity, Lock } from "lucide-react";

export default function GovernancePage() {
    return (
        <GovernanceLayout>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Trust Score"
                    value="A+"
                    icon={ShieldCheck}
                    description="Meets SOC2 Type II standard"
                />
                <StatCard
                    label="Active Policies"
                    value="12"
                    icon={Lock}
                    description="8 AI Guardrails, 4 Access Rules"
                />
                <StatCard
                    label="Event Velocity"
                    value="240"
                    icon={Activity}
                    trend={{ value: 5, isUp: true }}
                    description="Audit events processed last hour"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <Card title="Security Posture" subtitle="Comprehensive platform health check">
                    <div className="space-y-4 mt-2">
                        {[
                            { label: "Data Encryption at Rest", status: "Healthy", variant: "success" },
                            { label: "AI Output Sanitization", status: "Active", variant: "info" },
                            { label: "Brute Force Protection", status: "Healthy", variant: "success" },
                            { label: "SSO Enforced (Domain Wide)", status: "Disabled", variant: "warning" },
                            { label: "Two-Factor Auth", status: "Enabled", variant: "success" },
                        ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-sm font-medium text-white">{item.label}</span>
                                <Badge variant={item.variant as any}>{item.status}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Recent Policy Violations" subtitle="Last 24 hours of blocked actions">
                    <div className="flex flex-col items-center justify-center h-[240px] text-center">
                        <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                            <ShieldCheck className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h4 className="text-white font-bold">Zero Violations Detected</h4>
                        <p className="text-text-secondary text-sm max-w-xs mt-2">Your AI guardrails are effectively blocking restricted content and PII breaches.</p>
                    </div>
                </Card>
            </div>

            <div className="mt-8">
                <div className="bg-accent-violet/10 border border-accent-violet/30 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-accent-violet/20 p-3 rounded-xl text-accent-violet">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-white leading-tight">SOC2 Compliance Report Ready</h4>
                            <p className="text-text-secondary text-sm">A new quarterly audit report is available for export and legal review.</p>
                        </div>
                    </div>
                    <button className="bg-accent-violet text-white px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-glow">
                        Export Audit Bundle
                    </button>
                </div>
            </div>
        </GovernanceLayout>
    );
}
