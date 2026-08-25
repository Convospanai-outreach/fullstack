"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    Database,
    RefreshCcw,
    Settings,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Save,
    Link as LinkIcon
} from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface Integration {
    id: string;
    provider: string;
    isActive: boolean;
    fieldMapping: any;
}

export default function CRMSettingsPage() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeProvider, setActiveProvider] = useState<'HUBSPOT' | 'SALESFORCE'>('HUBSPOT');

    // Field mapping state for the active provider
    const [mapping, setMapping] = useState<any>({
        fullName: "firstname",
        email: "email",
        company: "company",
        jobTitle: "jobtitle"
    });

    const [apiKey, setApiKey] = useState("");

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/crm");
            const data = await res.json();
            setIntegrations(data);

            const active = data.find((i: Integration) => i.provider === activeProvider);
            if (active && active.fieldMapping) {
                setMapping(active.fieldMapping);
            }
        } catch (err) {
            toast.error("Failed to load CRM settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/crm", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: activeProvider,
                    accessToken: apiKey || undefined, // Only update if provided
                    isActive: true,
                    fieldMapping: mapping
                })
            });

            if (res.ok) {
                toast.success(`${activeProvider} integration updated`);
                fetchIntegrations();
            } else {
                toast.error("Failed to update settings");
            }
        } catch (err) {
            toast.error("Error saving configuration");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading CRM console...</div>;

    const currentIntegration = integrations.find(i => i.provider === activeProvider);

    return (
        <div className="space-y-8 max-w-6xl">
            <SectionHeader
                title="CRM Integration Layer"
                subtitle="Bidirectional sync for your leads and deal intelligence."
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Provider Selector */}
                <div className="lg:col-span-1 space-y-4">
                    <ProviderCard
                        name="HubSpot"
                        icon={<div className="w-8 h-8 bg-[#ff7a59] rounded-lg flex items-center justify-center text-white font-bold text-xs">HS</div>}
                        isActive={activeProvider === 'HUBSPOT'}
                        connected={integrations.some(i => i.provider === 'HUBSPOT' && i.isActive)}
                        onClick={() => setActiveProvider('HUBSPOT')}
                    />
                    <ProviderCard
                        name="Salesforce"
                        icon={<div className="w-8 h-8 bg-[#00A1E0] rounded-lg flex items-center justify-center text-white font-bold text-xs">SF</div>}
                        isActive={false}
                        connected={false}
                        comingSoon
                        onClick={() => toast.info("Salesforce sync isn't built yet — HubSpot is the only live integration.")}
                    />
                </div>

                {/* Configuration Console */}
                <GlassCard className="lg:col-span-3 p-8 space-y-8">
                    <div className="flex justify-between items-center border-b border-white/10 pb-6">
                        <div className="flex items-center gap-3">
                            <Database className="w-6 h-6 text-blue-400" />
                            <h3 className="text-xl font-bold text-white">{activeProvider} Configuration</h3>
                        </div>
                        {currentIntegration?.isActive ? (
                            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Connected
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-white/5 text-gray-500 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                                <XCircle className="w-3 h-3" /> Disconnected
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Auth Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-white/80 font-bold text-sm uppercase tracking-wider">
                                <LinkIcon className="w-4 h-4" /> Authentication
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-medium">Private App Access Token</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={currentIntegration ? "••••••••••••••••" : "pat-na1-..."}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-mono text-sm"
                                />
                                <p className="text-[10px] text-gray-500 italic">Required for secure API access to your {activeProvider} account.</p>
                            </div>
                        </div>

                        {/* Sync Settings */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-white/80 font-bold text-sm uppercase tracking-wider">
                                <RefreshCcw className="w-4 h-4" /> Sync Rules
                            </div>
                            <div className="space-y-4">
                                <SyncToggle label="Auto-sync new leads" description="Instantly create contacts in CRM." defaultChecked />
                                <SyncToggle label="Sync sentiment data" description="Write AI conversation analysis." />
                                <SyncToggle label="Update on status change" description="Keep lead lifecycle in sync." defaultChecked />
                            </div>
                        </div>
                    </div>

                    {/* Field Mapping */}
                    <div className="space-y-6 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-2 text-white/80 font-bold text-sm uppercase tracking-wider">
                            <Settings className="w-4 h-4" /> Attribute Mapping
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MappingItem
                                label="Lead Full Name"
                                value={mapping.fullName}
                                onChange={(v: string) => setMapping({ ...mapping, fullName: v })}
                            />
                            <MappingItem
                                label="Work Email"
                                value={mapping.email}
                                onChange={(v: string) => setMapping({ ...mapping, email: v })}
                            />
                            <MappingItem
                                label="Company Name"
                                value={mapping.company}
                                onChange={(v: string) => setMapping({ ...mapping, company: v })}
                            />
                            <MappingItem
                                label="Job Title"
                                value={mapping.jobTitle}
                                onChange={(v: string) => setMapping({ ...mapping, jobTitle: v })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : `Save ${activeProvider} Settings`}
                        </button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

function ProviderCard({ name, icon, isActive, connected, comingSoon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${isActive
                ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                : comingSoon
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
        >
            <div className="flex items-center gap-4 text-left">
                {icon}
                <div>
                    <div className="text-sm font-bold text-white">{name}</div>
                    <div className="text-[10px] text-gray-500">
                        {comingSoon ? 'Coming soon' : connected ? 'Connected' : 'Setup required'}
                    </div>
                </div>
            </div>
            {connected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        </button>
    );
}

function SyncToggle({ label, description, defaultChecked }: any) {
    return (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div>
                <div className="text-white text-xs font-bold">{label}</div>
                <div className="text-[10px] text-gray-400">{description}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
                <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
    );
}

function MappingItem({ label, value, onChange }: any) {
    return (
        <div className="flex items-center p-3 bg-slate-950/30 rounded-xl border border-white/5 gap-3">
            <div className="flex-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</div>
            <ArrowRight className="w-3 h-3 text-gray-700" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-32 bg-transparent text-xs text-blue-400 font-mono focus:outline-none focus:text-blue-300"
            />
        </div>
    );
}
