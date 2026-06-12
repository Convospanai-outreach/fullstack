"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Globe, Shield, Activity, Plus, Trash2, Eye, ShieldCheck, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AVAILABLE_EVENTS = [
    { id: "lead.created", label: "Lead Created" },
    { id: "lead.enriched", label: "Lead Enriched" },
    { id: "campaign.started", label: "Campaign Started" },
    { id: "campaign.finished", label: "Campaign Finished" },
    { id: "email.opened", label: "Email Opened" },
    { id: "email.replied", label: "Email Replied" },
];

export default function WebhooksPage() {
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newUrl, setNewUrl] = useState("");
    const [selectedEvents, setSelectedEvents] = useState<string[]>(["lead.enriched"]);
    const [selectedWebhookLogs, setSelectedWebhookLogs] = useState<any[] | null>(null);
    const [activeWebhookId, setActiveWebhookId] = useState<string | null>(null);
    const [inspectingLogId, setInspectingLogId] = useState<string | null>(null);

    useEffect(() => {
        loadWebhooks();
    }, []);

    const loadWebhooks = async () => {
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/webhooks");
            const data = await res.json();
            setWebhooks(data);
        } catch (e) {
            toast.error("Failed to load webhooks");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newUrl) return;
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/webhooks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: newUrl, events: selectedEvents })
            });

            if (res.ok) {
                toast.success("Webhook created");
                setNewUrl("");
                setShowCreate(false);
                loadWebhooks();
            }
        } catch (e) {
            toast.error("Failed to create webhook");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this webhook and all logs?")) return;
        try {
            await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/settings/webhooks?id=${id}`, { method: "DELETE" });
            toast.success("Webhook deleted");
            loadWebhooks();
        } catch (e) {
            toast.error("Failed to delete webhook");
        }
    };

    const loadLogs = async (webhookId: string) => {
        setActiveWebhookId(webhookId);
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/settings/webhooks/logs?webhookId=${webhookId}`);
            const data = await res.json();
            setSelectedWebhookLogs(data);
        } catch (e) {
            toast.error("Failed to load logs");
        }
    };

    const toggleEvent = (eventId: string) => {
        setSelectedEvents(prev =>
            prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]
        );
    };

    const sendTest = async (webhookId: string) => {
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/webhooks/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhookId })
            });
            if (res.ok) {
                toast.success("Test event dispatched");
                loadLogs(webhookId);
            }
        } catch (e) {
            toast.error("Test failed");
        }
    };

    const rotateSecret = async (webhookId: string) => {
        if (!confirm("Rotating the secret will immediately invalidate the previous one. Continue?")) return;
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/webhooks/secret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhookId })
            });
            if (res.ok) {
                await res.json();
                toast.success("Secret rotated");
                loadWebhooks(); // Refresh to show new secret if hidden/visible
            }
        } catch (e) {
            toast.error("Rotation failed");
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mr-auto">
            <SectionHeader
                title="Webhooks"
                subtitle="Receive real-time notifications to your external systems."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List & Config */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-400" /> Endpoints
                        </h3>
                        <button
                            onClick={() => setShowCreate(!showCreate)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Webhook
                        </button>
                    </div>

                    {showCreate && (
                        <GlassCard className="p-6 border-blue-500/20 bg-blue-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Endpoint URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://api.yourdomain.com/webhooks"
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        value={newUrl}
                                        onChange={e => setNewUrl(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Events to subscribe</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {AVAILABLE_EVENTS.map(ev => (
                                            <button
                                                key={ev.id}
                                                onClick={() => toggleEvent(ev.id)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedEvents.includes(ev.id)
                                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                    : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                                                    }`}
                                            >
                                                {ev.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
                                    <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold">Create</button>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    <div className="space-y-4">
                        {webhooks.map(wh => (
                            <GlassCard
                                key={wh.id}
                                className={`p-4 border-white/5 transition-all hover:border-white/10 ${activeWebhookId === wh.id ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="p-3 bg-white/5 rounded-xl text-gray-400">
                                            <Globe className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-white text-sm truncate max-w-[200px] md:max-w-md">{wh.url}</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {wh.events.map((ev: string) => (
                                                    <span key={ev} className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-gray-500 border border-white/5">
                                                        {ev}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3 text-green-500" /> Signed with HMAC
                                                </span>
                                                <div className="flex items-center gap-1.5 ">
                                                    <code className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">
                                                        {wh.secret ? `${wh.secret.substring(0, 4)}...${wh.secret.substring(wh.secret.length - 4)}` : 'No Secret'}
                                                    </code>
                                                    <button
                                                        onClick={() => rotateSecret(wh.id)}
                                                        className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase"
                                                    >
                                                        Rotate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => sendTest(wh.id)}
                                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded"
                                            title="Send Test Event"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => loadLogs(wh.id)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded"
                                            title="View Logs"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(wh.id)}
                                            className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                        {webhooks.length === 0 && !loading && (
                            <div className="text-center py-12 text-gray-500 italic border border-dashed border-white/5 rounded-xl">
                                No webhooks configured. Click "Add Webhook" to get started.
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Logs/Info */}
                <div className="lg:col-span-1 space-y-4">
                    <GlassCard className="p-6">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider flex items-center gap-2">
                            <Shield className="w-3 h-3 text-green-500" /> Security
                        </h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Webhooks are signed with an <span className="text-white">HMAC-SHA256</span> signature in the <code className="text-blue-400">X-CraftMyFunnel-Signature</code> header.
                        </p>
                    </GlassCard>

                    <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Delivery History</h3>
                            {activeWebhookId && <span className="text-[10px] text-blue-400 font-bold">Active</span>}
                        </div>
                        <div className="p-2 max-h-[400px] overflow-y-auto space-y-1">
                            {!selectedWebhookLogs ? (
                                <div className="text-center py-8 text-[11px] text-gray-500 italic">Select a webhook to view delivery logs</div>
                            ) : selectedWebhookLogs.length === 0 ? (
                                <div className="text-center py-8 text-[11px] text-gray-500 italic">No delivery attempts yet</div>
                            ) : (
                                selectedWebhookLogs.map(log => (
                                    <button
                                        key={log.id}
                                        onClick={() => setInspectingLogId(inspectingLogId === log.id ? null : log.id)}
                                        className={`w-full text-left p-3 rounded-lg space-y-2 transition-all group ${inspectingLogId === log.id ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {log.status >= 200 && log.status < 300
                                                    ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                    : <XCircle className="w-3 h-3 text-red-500" />
                                                }
                                                <div className="space-y-0.5">
                                                    <div className="text-[11px] font-bold text-white truncate w-32">{log.event}</div>
                                                    <div className="text-[9px] text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" /> {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-[10px] font-bold ${log.status >= 200 && log.status < 300 ? 'text-green-400' : 'text-red-400'}`}>
                                                {log.status || 'ERR'}
                                            </div>
                                        </div>

                                        {inspectingLogId === log.id && (
                                            <div className="pt-2 border-t border-white/5 space-y-2 animated fadeIn">
                                                <div className="space-y-1">
                                                    <div className="text-[9px] text-gray-500 uppercase font-bold">Payload</div>
                                                    <pre className="text-[9px] bg-black/40 p-2 rounded text-blue-200 overflow-x-auto">
                                                        {JSON.stringify(log.payload, null, 2)}
                                                    </pre>
                                                </div>
                                                {log.response && (
                                                    <div className="space-y-1">
                                                        <div className="text-[9px] text-gray-500 uppercase font-bold">Response</div>
                                                        <pre className="text-[9px] bg-black/40 p-2 rounded text-emerald-200 overflow-x-auto">
                                                            {typeof log.response === 'string' ? log.response : JSON.stringify(log.response, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
