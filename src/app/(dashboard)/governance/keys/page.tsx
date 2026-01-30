"use client";

import { useEffect, useState } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
    Key,
    Plus,
    Trash2,
    Copy,
    Eye,
    EyeOff,
    Terminal,
    Clock,
    ExternalLink,
    Activity,
    Loader2
} from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
    id: string;
    name: string;
    key: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
    isActive: boolean;
}

export default function SecurityKeysPage() {
    const [loading, setLoading] = useState(true);
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [creating, setCreating] = useState(false);
    const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);

    const fetchKeys = async () => {
        try {
            const res = await fetch("/api/governance/keys");
            const data = await res.json();
            if (data.success) setKeys(data.keys);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const createKey = async () => {
        setCreating(true);
        try {
            const res = await fetch("/api/governance/keys", {
                method: "POST",
                body: JSON.stringify({ name: newKeyName }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("API Key generated successfully");
                setKeys([data.key, ...keys]);
                setIsModalOpen(false);
                setNewKeyName("");
            }
        } catch (err) {
            toast.error("Failed to generate key");
        } finally {
            setCreating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <GovernanceLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">System Access Keys</h2>
                    <p className="text-text-secondary text-sm">Automate your workspace using the CovoSpan Public API.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Generate New Key
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                ) : keys.length === 0 ? (
                    <div className="glass p-12 rounded-3xl border-dashed border-2 border-white/10 flex flex-col items-center text-center">
                        <Key className="w-12 h-12 text-text-muted mb-4" />
                        <h4 className="text-lg font-bold text-white">No active API keys</h4>
                        <p className="text-sm text-text-secondary max-w-xs mt-2 mb-6">Create a key to start integrating your custom pipelines with ConvoSpan.</p>
                        <Button variant="outline" onClick={() => setIsModalOpen(true)}>Get Started with API</Button>
                    </div>
                ) : (
                    keys.map((key) => (
                        <div key={key.id} className="glass p-6 rounded-2xl border border-white/5 hover:bg-white/[0.02] transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-1">
                                <Badge variant={key.isActive ? "success" : "default"}>{key.isActive ? "Active" : "Revoked"}</Badge>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-accent-blue/10 rounded-lg text-accent-blue">
                                            <Terminal className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-bold text-white">{key.name}</h4>
                                    </div>

                                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs w-full max-w-xl group/key">
                                        <span className="text-accent-blue tabular-nums shrink-0">KEY_AUTH:</span>
                                        <span className="flex-1 overflow-hidden text-ellipsis text-text-secondary">
                                            {visibleKeyId === key.id ? key.key : "••••••••••••••••••••••••••••••••"}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button
                                                onClick={() => setVisibleKeyId(visibleKeyId === key.id ? null : key.id)}
                                                className="p-1.5 hover:bg-white/10 rounded-md transition text-text-muted hover:text-white"
                                            >
                                                {visibleKeyId === key.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(key.key)}
                                                className="p-1.5 hover:bg-white/10 rounded-md transition text-text-muted hover:text-white"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 text-right shrink-0">
                                    <div className="flex items-center gap-2 text-xs text-text-muted justify-end">
                                        <Clock className="w-3.5 h-3.5" />
                                        Created {new Date(key.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-text-muted justify-end">
                                        <Activity className="w-3.5 h-3.5" />
                                        {key.lastUsedAt ? `Last active ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}
                                    </div>
                                    <button className="text-xs text-red-400 font-bold hover:text-red-300 transition flex items-center gap-1 justify-end mt-2">
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Revoke Access
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                                {key.scopes.map(scope => (
                                    <span key={scope} className="text-[9px] font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-text-muted border border-white/5">
                                        {scope}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                <div className="mt-8 bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                            <ExternalLink className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-white">Public API Documentation</h4>
                            <p className="text-text-secondary text-sm">Learn how to build custom bots, webhook triggers, and lead processors.</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="text-blue-400 font-bold">Read Docs</Button>
                </div>
            </div>

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Generate API Key"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={createKey} disabled={creating}>
                            {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating</> : "Generate Key"}
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-text-secondary mb-6">Give your key a descriptive name to track its usage easily (e.g. "Production CRM Bridge").</p>
                <Input
                    label="Key Identifier"
                    placeholder="e.g. Hubspot Sync"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                />
            </Modal>
        </GovernanceLayout>
    );
}
