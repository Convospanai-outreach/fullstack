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
    Terminal,
    Clock,
    ExternalLink,
    Activity,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

interface ApiKey {
    id: string;
    name: string;
    displayKey: string;
    keyPrefix: string;
    keyLastFour: string | null;
    legacy: boolean;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
    isActive: boolean;
}

const API_KEY_SCOPE_OPTIONS = [
    "agents:read",
    "agents:write",
    "campaigns:read",
    "campaigns:write",
    "leads:read",
    "leads:write",
    "tasks:read",
    "tasks:write",
    "workflows:read",
    "workflows:write",
    "workflows:run",
];

export default function SecurityKeysPage() {
    const [loading, setLoading] = useState(true);
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [selectedScopes, setSelectedScopes] = useState<string[]>(["leads:read"]);
    const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const fetchKeys = async () => {
        try {
            const res = await fetch(getBrowserApiUrl("/governance/keys"));
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
        return () => setOneTimeSecret(null);
    }, []);

    const openCreateModal = () => {
        setOneTimeSecret(null);
        setIsModalOpen(true);
    };

    const closeCreateModal = () => {
        setIsModalOpen(false);
        setNewKeyName("");
        setSelectedScopes(["leads:read"]);
    };

    const toggleScope = (scope: string) => {
        setSelectedScopes(current => (
            current.includes(scope)
                ? current.filter(item => item !== scope)
                : [...current, scope]
        ));
    };

    const createKey = async () => {
        if (selectedScopes.length === 0) {
            toast.error("Select at least one scope");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch(getBrowserApiUrl("/governance/keys"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKeyName, scopes: selectedScopes }),
            });
            const data = await res.json();
            if (data.success) {
                const { secret, ...metadata } = data.key;
                toast.success("API Key generated successfully");
                setOneTimeSecret(secret);
                setKeys([metadata, ...keys]);
                closeCreateModal();
            } else {
                toast.error(data.error || "Failed to generate key");
            }
        } catch (err) {
            toast.error("Failed to generate key");
        } finally {
            setCreating(false);
        }
    };

    const copyOneTimeSecret = async () => {
        if (!oneTimeSecret) return;
        await navigator.clipboard.writeText(oneTimeSecret);
        toast.success("Copied to clipboard");
    };

    return (
        <GovernanceLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground">System Access Keys</h2>
                    <p className="text-muted-foreground text-sm">Automate your workspace using the CraftMyFunnel Public API.</p>
                </div>
                <Button onClick={openCreateModal} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Generate New Key
                </Button>
            </div>

            {oneTimeSecret && (
                <div className="mb-6 border border-success/40 bg-success/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-success">API key created</h3>
                            <p className="text-xs text-muted-foreground mt-1">This secret is shown once. Copy it now.</p>
                            <code className="mt-3 block rounded-lg bg-background border border-border p-3 text-xs text-foreground overflow-x-auto">
                                {oneTimeSecret}
                            </code>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button variant="outline" onClick={copyOneTimeSecret} className="gap-2">
                                <Copy className="w-4 h-4" />
                                Copy
                            </Button>
                            <Button variant="ghost" onClick={() => setOneTimeSecret(null)}>Done</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                ) : keys.length === 0 ? (
                    <div className="glass p-12 rounded-3xl border-dashed border-2 border-border flex flex-col items-center text-center">
                        <Key className="w-12 h-12 text-muted-foreground mb-4" />
                        <h4 className="text-lg font-bold text-foreground">No active API keys</h4>
                        <p className="text-sm text-muted-foreground max-w-xs mt-2 mb-6">Create a key to start integrating your custom pipelines with CraftMyFunnel.</p>
                        <Button variant="outline" onClick={openCreateModal}>Get Started with API</Button>
                    </div>
                ) : (
                    keys.map((key) => (
                        <div key={key.id} className="glass p-6 rounded-2xl border border-border hover:bg-muted transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-1">
                                <Badge variant={key.isActive ? "success" : "default"}>{key.isActive ? "Active" : "Revoked"}</Badge>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <Terminal className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-bold text-foreground">{key.name}</h4>
                                    </div>

                                    <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3 font-mono text-xs w-full max-w-xl">
                                        <span className="text-primary tabular-nums shrink-0">KEY_AUTH:</span>
                                        <span className="flex-1 overflow-hidden text-ellipsis text-muted-foreground">
                                            {key.displayKey}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 text-right shrink-0">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                                        <Clock className="w-3.5 h-3.5" />
                                        Created {new Date(key.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                                        <Activity className="w-3.5 h-3.5" />
                                        {key.lastUsedAt ? `Last active ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}
                                    </div>
                                    <button className="text-xs text-red-400 font-bold hover:text-red-300 transition flex items-center gap-1 justify-end mt-2">
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Revoke Access
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-border flex gap-2 flex-wrap">
                                {key.scopes.map(scope => (
                                    <span key={scope} className="text-[9px] font-bold uppercase tracking-wider bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border">
                                        {scope}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                <div className="mt-8 bg-primary/10 border border-primary/20 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/20 p-3 rounded-xl text-primary">
                            <ExternalLink className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-foreground">Public API Documentation</h4>
                            <p className="text-muted-foreground text-sm">Learn how to build custom bots, webhook triggers, and lead processors.</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="text-primary font-bold">Read Docs</Button>
                </div>
            </div>

            <Modal
                open={isModalOpen}
                onClose={closeCreateModal}
                title="Generate API Key"
                footer={(
                    <>
                        <Button variant="ghost" onClick={closeCreateModal}>Cancel</Button>
                        <Button onClick={createKey} disabled={creating}>
                            {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating</> : "Generate Key"}
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-muted-foreground mb-6">Give your key a descriptive name to track its usage easily (e.g. "Production CRM Bridge").</p>
                <Input
                    label="Key Identifier"
                    placeholder="e.g. Hubspot Sync"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                />
                <div className="mt-6">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Scopes</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {API_KEY_SCOPE_OPTIONS.map(scope => (
                            <label key={scope} className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={selectedScopes.includes(scope)}
                                    onChange={() => toggleScope(scope)}
                                />
                                {scope}
                            </label>
                        ))}
                    </div>
                </div>
            </Modal>
        </GovernanceLayout>
    );
}
