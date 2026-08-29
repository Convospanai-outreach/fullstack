"use client";

import Link from "next/link";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Activity, Lock } from "lucide-react";

export default function GovernancePage() {
    return (
        <GovernanceLayout>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Trust Score"
                    value="Pending"
                    icon={ShieldCheck}
                    description="Calculates domain reputation & security posture after 25+ events"
                />
                <StatCard
                    label="Active Policies"
                    value="8"
                    icon={Lock}
                    description="8 AI Guardrails active"
                />
                <StatCard
                    label="Event Velocity"
                    value="0"
                    icon={Activity}
                    description="Audit events processed last hour"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Security Posture</CardTitle>
                        <CardDescription>Comprehensive platform health check</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 mt-2">
                            {[
                                { label: "Data Encryption at Rest", status: "Healthy", variant: "success" },
                                { label: "AI Output Sanitization", status: "Active", variant: "info" },
                                { label: "Brute Force Protection", status: "Healthy", variant: "success" },
                                { label: "SSO Enforced (Domain Wide)", status: "Disabled", variant: "warning" },
                                { label: "Two-Factor Auth", status: "Enabled", variant: "success" },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-muted border border-border">
                                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                                    <Badge variant={item.variant as any}>{item.status}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Policy Violations</CardTitle>
                        <CardDescription>Last 24 hours of blocked actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center h-[240px] text-center">
                            <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                                <ShieldCheck className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h4 className="text-foreground font-bold">Zero Violations Detected</h4>
                            <p className="text-muted-foreground text-sm max-w-xs mt-2">Your AI guardrails are effectively blocking restricted content and PII breaches.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <div className="bg-muted border border-border p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-muted p-3 rounded-xl text-foreground">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-foreground leading-tight">Compliance & Governance Logging Active</h4>
                            <p className="text-muted-foreground text-sm">Audit logs and prompt guardrail policies are recorded for workspace activity.</p>
                        </div>
                    </div>
                    <Link
                        href="/governance/audit"
                        className="bg-muted text-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-accent transition border border-border"
                    >
                        View Audit Log
                    </Link>
                </div>
            </div>
        </GovernanceLayout>
    );
}
