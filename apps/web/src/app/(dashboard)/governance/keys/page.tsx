"use client";

import { useEffect, useState } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  Activity,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type ApiKeyMetadata = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  keyPrefix: string;
  keyLastFour: string | null;
  legacy: boolean;
};

export default function SecurityKeysPage() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const response = await fetch(
        process.env["NEXT_PUBLIC_API_URL"] + "/governance/keys?limit=20"
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.error("Unable to load API keys");
        return;
      }
      setKeys(payload.keys);
    } catch {
      toast.error("Unable to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKeys();
  }, []);

  const createKey = async () => {
    setCreating(true);
    try {
      const response = await fetch(
        process.env["NEXT_PUBLIC_API_URL"] + "/governance/keys",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newKeyName }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.error(payload.error ?? "Unable to create API key");
        return;
      }

      setNewSecret(payload.secret);
      setKeys((current) => [payload.apiKey, ...current]);
      setIsModalOpen(false);
      setNewKeyName("");
      toast.success("API key created");
    } catch {
      toast.error("Unable to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this key? Integrations using it will stop working.")) return;

    try {
      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/settings/keys/${id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        toast.error("Unable to revoke API key");
        return;
      }
      setKeys((current) =>
        current.map((key) => key.id === id ? { ...key, isActive: false } : key)
      );
      toast.success("API key revoked");
    } catch {
      toast.error("Unable to revoke API key");
    }
  };

  const copySecret = () => {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret);
    toast.success("Copied to clipboard");
  };

  return (
    <GovernanceLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">System Access Keys</h2>
          <p className="text-text-secondary text-sm">
            Manage least-privilege access to your public API.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Generate New Key
        </Button>
      </div>

      {newSecret && (
        <div className="mb-6 glass p-6 rounded-2xl border border-green-500/30">
          <div className="flex items-center gap-2 text-green-300 font-bold">
            <Check className="w-5 h-5" />
            Key created — copy it now
          </div>
          <p className="text-sm text-text-secondary mt-2">
            This is the only time this secret is displayed.
          </p>
          <div className="mt-4 flex gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-black/40 p-3 text-sm text-white">
              {newSecret}
            </code>
            <Button variant="outline" onClick={copySecret} aria-label="Copy newly created API key">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-3 text-xs text-text-muted hover:text-white"
          >
            I have saved it
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))
        ) : keys.length === 0 ? (
          <div className="glass p-12 rounded-3xl border-dashed border-2 border-white/10 flex flex-col items-center text-center">
            <Key className="w-12 h-12 text-text-muted mb-4" />
            <h4 className="text-lg font-bold text-white">No API keys</h4>
            <p className="text-sm text-text-secondary max-w-xs mt-2 mb-6">
              Create a least-privilege key for an approved integration.
            </p>
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              Get Started with API
            </Button>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="glass p-6 rounded-2xl border border-white/5">
              <div className="absolute" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent-blue/10 rounded-lg text-accent-blue">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-white">{key.name}</h4>
                    <Badge variant={key.isActive ? "success" : "default"}>
                      {key.isActive ? "Active" : "Revoked"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs w-full max-w-xl">
                    <span className="text-accent-blue tabular-nums shrink-0">KEY_AUTH:</span>
                    <span className="flex-1 overflow-hidden text-ellipsis text-text-secondary">
                      {key.keyPrefix}••••{key.keyLastFour ?? ""}
                    </span>
                    {key.legacy && (
                      <span className="text-amber-300">legacy rotation pending</span>
                    )}
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
                  {key.isActive && (
                    <button
                      onClick={() => revokeKey(key.id)}
                      className="text-xs text-red-400 font-bold hover:text-red-300 transition flex items-center gap-1 justify-end mt-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke Access
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                {key.scopes.map((scope) => (
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
              <p className="text-text-secondary text-sm">
                Use an approved key with only the scopes an integration needs.
              </p>
            </div>
          </div>
          <Button variant="ghost" className="text-blue-400 font-bold">Read Docs</Button>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate API Key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating</> : "Generate Key"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary mb-6">
          New keys receive the least-privilege read scope by default.
        </p>
        <Input
          label="Key Identifier"
          placeholder="e.g. Hubspot Sync"
          value={newKeyName}
          maxLength={80}
          onChange={(event) => setNewKeyName(event.target.value)}
          autoFocus
        />
      </Modal>
    </GovernanceLayout>
  );
}
