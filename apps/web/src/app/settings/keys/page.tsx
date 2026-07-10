"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { Check, Copy, Key, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");

  useEffect(() => {
    void loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const response = await fetch(
        process.env["NEXT_PUBLIC_API_URL"] + "/settings/keys?limit=20"
      );
      if (!response.ok) throw new Error("Unable to load API keys");
      const payload = await response.json();
      setKeys(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      toast.error("Unable to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch(
        process.env["NEXT_PUBLIC_API_URL"] + "/settings/keys",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: createName }),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Unable to create API key");
        return;
      }

      setNewSecret(payload.secret);
      setKeys((current) => [payload.apiKey, ...current]);
      setShowCreate(false);
      setCreateName("");
      toast.success("API key created");
    } catch {
      toast.error("Unable to create API key");
    }
  };

  const handleRevoke = async (id: string) => {
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
    <div className="space-y-8 max-w-5xl mr-auto">
      <SectionHeader title="API Keys" subtitle="Manage access keys for the Public API" />

      {newSecret && (
        <div className="p-6 bg-green-900/20 border border-green-500/50 rounded-xl space-y-4">
          <h3 className="text-green-400 font-bold flex items-center gap-2">
            <Check className="w-5 h-5" /> Key Created Successfully
          </h3>
          <p className="text-sm text-gray-300">
            This is the only time you will see this key. Please copy it immediately.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-black/50 p-3 rounded font-mono text-white overflow-x-auto">
              {newSecret}
            </code>
            <button onClick={copySecret} className="p-3 bg-white/10 hover:bg-white/20 rounded text-white">
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="text-sm text-gray-400 hover:text-white underline">
            I have saved it
          </button>
        </div>
      )}

      <GlassCard className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">API Keys</h3>
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
                maxLength={80}
                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-white"
                placeholder="e.g. Zapier Integration"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!createName.trim()}
              className="px-4 py-2 bg-green-600 disabled:opacity-50 text-white rounded font-medium"
            >
              Generate
            </button>
          </div>
        )}

        <div className="space-y-4">
          {keys.map((key) => (
            <div key={key.id} className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded text-purple-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">{key.name}</h4>
                  <div className="text-xs text-gray-500">
                    {key.keyPrefix}••••{key.keyLastFour ?? ""} • Created {new Date(key.createdAt).toLocaleDateString()} •
                    Last used: {key.lastUsedAt ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true }) : "Never"}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {key.scopes.map((scope) => (
                      <span key={scope} className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-gray-300">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {key.isActive ? (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded"
                  aria-label={`Revoke ${key.name}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              ) : (
                <span className="text-xs text-gray-500">Revoked</span>
              )}
            </div>
          ))}

          {keys.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500 italic">No API keys.</div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
