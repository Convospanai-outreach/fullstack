"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    ShieldCheck,
    Zap,
    Search,
    Upload,
    ClipboardCheck,
    Users,
    Activity,
    BarChart3,
    Lock as LockIcon,
    Wallet,
    Database,
    Eye,
    Shield
} from 'lucide-react';
import Link from 'next/link';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function GovernancePage() {
    const [policy, setPolicy] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPolicy();
    }, []);

    const fetchPolicy = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/governance");
            const data = await res.json();
            setPolicy(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load governance policy");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (field: string, value: any) => {
        setPolicy((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/governance", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(policy)
            });
            if (res.ok) {
                toast.success("Governance policy updated successfully");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update policy");
            }
        } catch (err) {
            toast.error("Error saving policy");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-foreground">Loading governance settings...</div>;
    if (!policy) return <div className="p-8 text-foreground">Error loading policy.</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Enterprise Governance"
                    subtitle="Control operational guardrails, rate limits, and compliance logic for your entire organization."
                />
                <Link
                    href="/settings/governance/analytics"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium transition-all border border-blue-500/20"
                >
                    <BarChart3 className="w-4 h-4" />
                    View Analytics
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Operational Limits */}
                <GlassCard className="p-6 space-y-6 col-span-1">
                    <div className="flex items-center gap-4 border-b border-border pb-4">
                        <div className="bg-blue-500/20 p-3 rounded-xl">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Operational Limits</h3>
                            <p className="text-sm text-muted-foreground">Cap maximum daily actions to ensure safety.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Max Daily Actions (Agents + Campaigns)</label>
                            <input
                                type="number"
                                value={policy.maxDailyActions}
                                onChange={(e) => handleUpdate("maxDailyActions", parseInt(e.target.value))}
                                className="w-full bg-background border border-input rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Concurrent Campaigns</label>
                            <input
                                type="number"
                                value={policy.maxCampaigns}
                                onChange={(e) => handleUpdate("maxCampaigns", parseInt(e.target.value))}
                                className="w-full bg-background border border-input rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </GlassCard>

                {/* Automation Guardrails */}
                <GlassCard className="p-6 space-y-6 col-span-1">
                    <div className="flex items-center gap-4 border-b border-border pb-4">
                        <div className="bg-purple-500/20 p-3 rounded-xl">
                            <Zap className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Platform Guardrails</h3>
                            <p className="text-sm text-muted-foreground">Enable or disable specific automation vectors.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                                <Search className="w-5 h-5 text-muted-foreground" />
                                <span className="text-foreground">Allow Web Scraping</span>
                            </div>
                            <Toggle
                                checked={policy.allowScraping}
                                onChange={(val) => handleUpdate("allowScraping", val)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                                <span className="text-foreground">Allow LinkedIn InMails</span>
                            </div>
                            <Toggle
                                checked={policy.allowInMail}
                                onChange={(val) => handleUpdate("allowInMail", val)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                                <span className="text-foreground">Allow CSV Uploads</span>
                            </div>
                            <Toggle
                                checked={policy.allowUploads}
                                onChange={(val) => handleUpdate("allowUploads", val)}
                            />
                        </div>
                    </div>
                </GlassCard>

                {/* Compliance & Approvals */}
                <GlassCard className="p-6 space-y-6 col-span-full">
                    <div className="flex items-center gap-4 border-b border-border pb-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl">
                            <ClipboardCheck className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Compliance & Approvals</h3>
                            <p className="text-sm text-muted-foreground">Enforce human-in-the-loop workflows for sensitive actions.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-emerald-950/20 rounded-xl border border-emerald-500/10">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-foreground font-medium">Require Approval for Campaign Launch</div>
                                <div className="text-xs text-muted-foreground">All campaigns must be approved by an Admin before execution.</div>
                            </div>
                        </div>
                        <Toggle
                            checked={policy.requiresApprovalForCampaign}
                            onChange={(val) => handleUpdate("requiresApprovalForCampaign", val)}
                        />
                    </div>
                </GlassCard>

                {/* Identity & Access */}
                <GlassCard className="p-6 space-y-6 col-span-full">
                    <div className="flex items-center gap-4 border-b border-border pb-4">
                        <div className="bg-orange-500/20 p-3 rounded-xl">
                            <LockIcon className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Identity & Access</h3>
                            <p className="text-sm text-muted-foreground">Manage SAML/OIDC authentication and domain enforcement.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-orange-950/20 rounded-xl border border-orange-500/10">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-500/10 p-2 rounded-lg text-orange-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-foreground font-medium">Single Sign-On (SSO)</div>
                                <div className="text-xs text-muted-foreground">Configure corporate identity providers for secure access.</div>
                            </div>
                        </div>
                        <Link
                            href="/settings/sso"
                            className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-bold transition-all border border-orange-500/20"
                        >
                            Configure SSO
                        </Link>
                    </div>
                </GlassCard>

                {/* Budgeting & Quotas Link (Quick Access) */}
                <GlassCard className="p-6 space-y-4 col-span-1 border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <Wallet className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-sm">Financial Controls</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Manage per-user credit limits and overage approvals.</p>
                    <Link
                        href="/settings/budgeting"
                        className="block text-center py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        Configure Budgeting
                    </Link>
                </GlassCard>

                {/* CRM Integration Link */}
                <GlassCard className="p-6 space-y-4 col-span-1 border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg">
                            <Database className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-sm">Data Pipelines</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Sync lead intelligence directly to HubSpot or Salesforce.</p>
                    <Link
                        href="/settings/crm"
                        className="block text-center py-2 bg-emerald-600 hover:bg-emerald-600/80 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        Manage CRM
                    </Link>
                </GlassCard>

                {/* HITL Link */}
                <GlassCard className="p-6 space-y-4 col-span-1 border-purple-500/20 bg-purple-500/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-500/20 p-2 rounded-lg">
                            <Eye className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-sm">Human Intercepts</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Review AI decisions before they are executed.</p>
                    <Link
                        href="/settings/hitl"
                        className="block text-center py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        View Intercepts
                    </Link>
                </GlassCard>

                {/* Guardrails Link */}
                <GlassCard className="p-6 space-y-4 col-span-1 border-red-500/20 bg-red-500/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 p-2 rounded-lg">
                            <Shield className="w-5 h-5 text-red-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-sm">Policy Engine</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Block unsafe keywords, PII, and custom regex patterns.</p>
                    <Link
                        href="/settings/guardrails"
                        className="block text-center py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        Configure Rules
                    </Link>
                </GlassCard>
            </div>

            <div className="flex justify-end gap-3 mt-8">
                <button
                    onClick={fetchPolicy}
                    className="px-6 py-2 bg-muted hover:bg-accent text-foreground rounded-xl transition-all border border-border"
                >
                    Discard
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    {saving ? "Saving..." : "Apply Governance Policy"}
                </button>
            </div>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    );
}
