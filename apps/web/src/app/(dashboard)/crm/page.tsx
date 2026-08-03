"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Plug,
    ArrowRightLeft,
    Settings,
    Database,
    AlertTriangle
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CrmIntegration {
    id: string;
    provider: string; // 'SALESFORCE' | 'HUBSPOT' | 'PIPEDRIVE'
    isActive: boolean;
    syncSettings: any;
    lastSyncAt?: string;
}

export default function CRMIntegrationPage() {
    const { data: integrations } = useSWR<CrmIntegration[]>((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/settings/crm", fetcher);
    const [connecting, setConnecting] = useState<string | null>(null);

    const handleConnect = async (provider: string) => {
        toast.info(`${provider} integration is in Preview mode. Native CRM sync is under active development.`);
    };

    const handleSync = async (provider: string) => {
        toast.info(`${provider} sync is in Preview mode. Native CRM sync is under active development.`);
    };

    return (
        <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-black text-white tracking-tight">CRM Bridge</h1>
                            <Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30">Integration Preview</Badge>
                        </div>
                        <p className="text-text-secondary max-w-2xl">
                            Bi-directional sync between CraftMyFunnel and your System of Record.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 flex items-center gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                    <span>
                        <strong className="font-bold text-white">Integration Preview:</strong> Native CRM Sync is currently under active development. Connector cards demonstrate configuration layout.
                    </span>
                </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Integration Cards */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plug className="w-5 h-5 text-accent-blue" />
                        Available Connectors
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ConnectorCard
                            name="Salesforce"
                            icon="/icons/salesforce.svg" // Placeholder path
                            description="Deep integration with Sales Cloud. Supports Leads, Contacts, and Opportunities objects."
                            status={integrations?.find(i => i.provider === 'SALESFORCE')?.isActive ? 'active' : 'inactive'}
                            onConnect={() => handleConnect('SALESFORCE')}
                            onSync={() => handleSync('SALESFORCE')}
                            loading={connecting === 'SALESFORCE'}
                        />
                        <ConnectorCard
                            name="HubSpot"
                            icon="/icons/hubspot.svg" // Placeholder path
                            description="Two-way sync for Contacts and Deals. Captures email activity and meeting notes."
                            status={integrations?.find(i => i.provider === 'HUBSPOT')?.isActive ? 'active' : 'inactive'}
                            onConnect={() => handleConnect('HUBSPOT')}
                            onSync={() => handleSync('HUBSPOT')}
                            loading={connecting === 'HUBSPOT'}
                        />
                        <ConnectorCard
                            name="Pipedrive"
                            icon="/icons/pipedrive.svg" // Placeholder path
                            description="Sync Persons and Organizations. Ideal for high-velocity sales teams."
                            status={integrations?.find(i => i.provider === 'PIPEDRIVE')?.isActive ? 'active' : 'inactive'}
                            onConnect={() => handleConnect('PIPEDRIVE')}
                            onSync={() => handleSync('PIPEDRIVE')}
                            loading={connecting === 'PIPEDRIVE'}
                        />
                        <div className="glass p-6 rounded-2xl border border-white/5 border-dashed flex flex-col items-center justify-center text-center opacity-70 hover:opacity-100 transition">
                            <Database className="w-10 h-10 text-text-muted mb-4 opacity-30" />
                            <h3 className="text-white font-bold mb-1">Request a Connector</h3>
                            <p className="text-xs text-text-muted mb-4">Need Zoho, Dynamics, or Copper?</p>
                            <Button variant="ghost">Contact Product Team</Button>
                        </div>
                    </div>
                </div>

                {/* Sidebar configurations or logs */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Auto-Push Qualified Leads</h4>
                                        <p className="text-[10px] text-text-secondary mt-1">
                                            Automatically create CRM contacts when a lead replies or reaches score 80+
                                        </p>
                                    </div>
                                    <div className="h-6 w-11 bg-accent-blue rounded-full relative cursor-pointer">
                                        <div className="absolute top-1 right-1 h-4 w-4 bg-white rounded-full transition-all shadow-sm" />
                                    </div>
                                </div>

                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Bi-Directional Opt-Outs</h4>
                                        <p className="text-[10px] text-text-secondary mt-1">
                                            If marked DND in CRM, immediately stop campaigns in CraftMyFunnel
                                        </p>
                                    </div>
                                    <div className="h-6 w-11 bg-white/10 rounded-full relative cursor-pointer">
                                        <div className="absolute top-1 left-1 h-4 w-4 bg-white/50 rounded-full transition-all shadow-sm" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <Button className="w-full gap-2" variant="outline">
                                        <Settings className="w-4 h-4" />
                                        Map Custom Fields
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Sync Interactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="flex gap-3 items-start p-3 hover:bg-white/5 rounded-xl transition">
                                        <div className={`mt-0.5 p-1.5 rounded-full ${i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            <ArrowRightLeft className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-white">
                                                {i === 0 ? "Pushed lead 'Sarah Chen' to Salesforce" : "Updated 'TechCorp' opportunity stage"}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-text-muted">2 mins ago</span>
                                                {i === 0 && <Badge variant="success" className="px-1 py-0 text-[9px] h-4">Success</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="ghost" className="w-full text-xs text-text-muted">Older Logs</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ConnectorCard({ name, icon: _icon, description, status, onConnect, onSync, loading }: any) {
    const isActive = status === 'active';

    return (
        <div className="glass p-6 rounded-2xl border border-white/5 hover:border-accent-blue/30 transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg">
                    {/* Fallback specific icon handling or img */}
                    <div className="text-black font-black text-xs">{name.substring(0, 2).toUpperCase()}</div>
                </div>
                <Badge variant={isActive ? "success" : "default"} className={isActive ? "bg-emerald-500/20 text-emerald-400 border-none" : "bg-white/5 text-text-muted"}>
                    {isActive ? "Connected" : "Not Connected"}
                </Badge>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{name}</h3>
            <p className="text-xs text-text-secondary h-16 leading-relaxed mb-6">
                {description}
            </p>

            <div className="flex gap-2">
                {isActive ? (
                    <>
                        <Button
                            variant="default"
                            className="flex-1 bg-white/5 hover:bg-white/10 border-white/10"
                            onClick={onSync}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Now
                        </Button>
                        <Button variant="ghost" className="px-3" title="Settings">
                            <Settings className="w-4 h-4" />
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="outline"
                        disabled={loading}
                        onClick={onConnect}
                        className="w-full text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10"
                    >
                        {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Connect {name}
                    </Button>
                )}
            </div>
        </div>
    );
}
