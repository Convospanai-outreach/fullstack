"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    ShieldCheck,
    Link as LinkIcon,
    Lock,
    Globe,
    Save,
    Trash2,
    CheckCircle2
} from 'lucide-react';

export default function SsoSettingsPage() {
    const [config, setConfig] = useState<any>({
        providerType: 'SAML',
        enforced: false,
        allowedDomains: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newDomain, setNewDomain] = useState("");

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/sso");
            const data = await res.json();
            if (data && data.teamId) {
                setConfig(data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load SSO configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (field: string, value: any) => {
        setConfig((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/sso", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                toast.success("SSO configuration updated");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update SSO");
            }
        } catch (err) {
            toast.error("Error saving configuration");
        } finally {
            setSaving(false);
        }
    };

    const addDomain = () => {
        if (!newDomain || !newDomain.includes(".")) return;
        if (config.allowedDomains.includes(newDomain)) return;
        handleUpdate("allowedDomains", [...config.allowedDomains, newDomain]);
        setNewDomain("");
    };

    const removeDomain = (domain: string) => {
        handleUpdate("allowedDomains", config.allowedDomains.filter((d: string) => d !== domain));
    };

    if (loading) return <div className="p-8 text-white">Loading SSO settings...</div>;

    const isConfigured = config.providerType === 'SAML'
        ? (config.entryPoint && config.issuer)
        : (config.clientId && config.wellKnownUrl);

    return (
        <div className="space-y-8 max-w-5xl">
            <SectionHeader
                title="Single Sign-On (SSO)"
                subtitle="Secure your organization with SAML or OIDC authentication."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Provider Selection */}
                    <GlassCard className="p-6 space-y-4">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <LinkIcon className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-bold text-white">Identity Provider</h3>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleUpdate("providerType", "SAML")}
                                className={`flex-1 py-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${config.providerType === 'SAML' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                            >
                                <span className="font-bold">SAML 2.0</span>
                                <span className="text-[10px] opacity-60">Okta, JumpCloud, OneLogin</span>
                            </button>
                            <button
                                onClick={() => handleUpdate("providerType", "OIDC")}
                                className={`flex-1 py-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${config.providerType === 'OIDC' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                            >
                                <span className="font-bold">OIDC</span>
                                <span className="text-[10px] opacity-60">Azure AD, Google, Auth0</span>
                            </button>
                        </div>
                    </GlassCard>

                    {/* Configuration Form */}
                    <GlassCard className="p-6 space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-lg font-bold text-white">Configuration Details</h3>
                        </div>

                        {config.providerType === 'SAML' ? (
                            <div className="grid grid-cols-1 gap-4">
                                <Input label="Metadata URL (Optional)" value={config.metadataUrl} onChange={(v: string) => handleUpdate("metadataUrl", v)} placeholder="https://..." />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="SSO Entry Point" value={config.entryPoint} onChange={(v: string) => handleUpdate("entryPoint", v)} placeholder="https://idp.example.com/sso" />
                                    <Input label="Issuer / Entity ID" value={config.issuer} onChange={(v: string) => handleUpdate("issuer", v)} placeholder="urn:enterprise:sso" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Public Certificate (X.509)</label>
                                    <textarea
                                        value={config.certificate}
                                        onChange={(e) => handleUpdate("certificate", e.target.value)}
                                        placeholder="-----BEGIN CERTIFICATE----- ... ----END CERTIFICATE-----"
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 min-h-[100px]"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                <Input label="Well-Known Discovery URL" value={config.wellKnownUrl} onChange={(v: string) => handleUpdate("wellKnownUrl", v)} placeholder="https://..." />
                                <Input label="Client ID" value={config.clientId} onChange={(v: string) => handleUpdate("clientId", v)} />
                                <Input label="Client Secret" value={config.clientSecret} onChange={(v: string) => handleUpdate("clientSecret", v)} type="password" />
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-6">
                    {/* Status & Enforcement */}
                    <GlassCard className="p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <h3 className="font-bold text-white">Status</h3>
                            {isConfigured ? (
                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                </div>
                            ) : (
                                <div className="text-gray-500 text-xs font-bold">INCOMPLETE</div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                            <div className="flex items-center gap-3">
                                <Lock className="w-4 h-4 text-red-400" />
                                <div>
                                    <div className="text-white text-xs font-bold">Enforce SSO</div>
                                    <div className="text-[10px] text-gray-500">Disable password login.</div>
                                </div>
                            </div>
                            <Toggle checked={config.enforced} onChange={(v: boolean) => handleUpdate("enforced", v)} />
                        </div>
                    </GlassCard>

                    {/* Domains */}
                    <GlassCard className="p-6 space-y-4">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <Globe className="w-4 h-4 text-blue-400" />
                            <h3 className="font-bold text-white">Allowed Domains</h3>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                placeholder="acme.com"
                                className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                            <button onClick={addDomain} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all">Add</button>
                        </div>

                        <div className="space-y-2 h-32 overflow-y-auto pr-2 custom-scrollbar">
                            {config.allowedDomains.map((domain: string) => (
                                <div key={domain} className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                                    <span className="text-xs text-white">{domain}</span>
                                    <button onClick={() => removeDomain(domain)} className="text-gray-500 hover:text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {config.allowedDomains.length === 0 && (
                                <div className="text-center text-[10px] text-gray-500 py-4 italic">No domains configured. Users from any domain can log in if SSO is not enforced.</div>
                            )}
                        </div>
                    </GlassCard>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save SSO Config"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Input({ label, value, onChange, placeholder, type = "text" }: any) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium px-1 uppercase tracking-wider">{label}</label>
            <input
                type={type}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-slate-800/50 transition-all"
            />
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    );
}
