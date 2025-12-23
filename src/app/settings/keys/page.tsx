"use client";

import React, { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Key, Trash2, Copy, Check, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState("");

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        try {
            const res = await fetch("/api/settings/keys");
            const data = await res.json();
            setKeys(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch("/api/settings/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: createName, scopes: ["leads:read", "campaigns:read", "leads:write"] })
            });
            const data = await res.json();

            if (res.ok) {
                setNewKey(data.key);
                loadKeys();
                setShowCreate(false);
                setCreateName("");
                toast.success("API Key created");
            }
        } catch (e) {
            toast.error("Failed to create key");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Integration using this key will stop working.")) return;
        try {
            await fetch(`/api/settings/keys/${id}`, { method: "DELETE" });
            toast.success("Key revoked");
            loadKeys();
        } catch (e) {
            toast.error("Failed to revoke key");
        }
    };

    const copyKey = () => {
        if (newKey) {
            navigator.clipboard.writeText(newKey);
            toast.success("Copied to clipboard");
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mr-auto">
            <SectionHeader
                title="API Keys"
                subtitle="Manage access keys for the Public API"
            />

            {newKey && (
                <div className="p-6 bg-green-900/20 border border-green-500/50 rounded-xl space-y-4">
                    <h3 className="text-green-400 font-bold flex items-center gap-2">
                        <Check className="w-5 h-5" /> Key Created Successfully
                    </h3>
                    <p className="text-sm text-gray-300">
                        This is the only time you will see this key. Please copy it immediately.
                    </p>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black/50 p-3 rounded font-mono text-white overflow-x-auto">
                            {newKey}
                        </code>
                        <button onClick={copyKey} className="p-3 bg-white/10 hover:bg-white/20 rounded text-white">
                            <Copy className="w-5 h-5" />
                        </button>
                    </div>
                    <button onClick={() => setNewKey(null)} className="text-sm text-gray-400 hover:text-white underline">
                        I have saved it
                    </button>
                </div>
            )}

            <GlassCard className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Active Keys</h3>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium"
                    >
                        <Plus className="w-4 h-4" /> Create New Key
                    </button>
                </div>

                {showCreate && (
                    <div className="mb-6 p-4 bg-white/5 rounded-lg flex items-end gap-3 animated fadeIn">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs text-gray-400 uppercase">Key Name</label>
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-white"
                                placeholder="e.g. Zapier Integration"
                                value={createName}
                                onChange={e => setCreateName(e.target.value)}
                            />
                        </div>
                        <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded font-medium">
                            Generate
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {keys.map(key => (
                        <div key={key.id} className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-500/20 rounded text-purple-400">
                                    <Key className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{key.name}</h4>
                                    <div className="text-xs text-gray-500">
                                        Created {new Date(key.createdAt).toLocaleDateString()} •
                                        Last used: {key.lastUsedAt ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true }) : "Never"}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        {key.scopes.map((scope: string) => (
                                            <span key={scope} className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-gray-300">
                                                {scope}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(key.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}

                    {keys.length === 0 && !loading && (
                        <div className="text-center py-8 text-gray-500 italic">No active API keys.</div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
