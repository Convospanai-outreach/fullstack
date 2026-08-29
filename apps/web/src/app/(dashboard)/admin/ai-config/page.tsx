"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type ProviderConfig = {
  apiKey: string | null;
  model: string;
};

type AiConfigResponse = {
  teamId: string;
  providers: {
    gemini: ProviderConfig;
    openai: ProviderConfig;
    anthropic: ProviderConfig;
  };
};

export default function AdminAiConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AiConfigResponse | null>(null);
  const [form, setForm] = useState({
    geminiApiKey: "",
    geminiModel: "gemini-1.5-pro",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    anthropicApiKey: "",
    anthropicModel: "claude-3-5-sonnet"
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(getBrowserApiUrl("/admin/ai-config"));
      if (!res.ok) throw new Error("Failed to load AI config");
      const data: AiConfigResponse = await res.json();
      setConfig(data);
      setForm({
        geminiApiKey: "",
        geminiModel: data.providers.gemini.model,
        openaiApiKey: "",
        openaiModel: data.providers.openai.model,
        anthropicApiKey: "",
        anthropicModel: data.providers.anthropic.model
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(getBrowserApiUrl("/admin/ai-config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Failed to save AI config");
      await loadConfig();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <SectionHeader
          title="AI Provider Configuration"
          subtitle="Manage Gemini, OpenAI, and Anthropic keys for this team"
        />

        {loading && <div className="text-foreground">Loading configuration...</div>}

        {!loading && config && (
          <GlassCard className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Gemini</h3>
              <p className="text-sm text-muted-foreground">
                Current key: {config.providers.gemini.apiKey || "Not set"}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="Gemini API Key"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.geminiApiKey}
                  onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Model (e.g. gemini-1.5-pro)"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.geminiModel}
                  onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground">OpenAI</h3>
              <p className="text-sm text-muted-foreground">
                Current key: {config.providers.openai.apiKey || "Not set"}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="OpenAI API Key"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.openaiApiKey}
                  onChange={(e) => setForm({ ...form, openaiApiKey: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Model (e.g. gpt-4o-mini)"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.openaiModel}
                  onChange={(e) => setForm({ ...form, openaiModel: e.target.value })}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground">Anthropic</h3>
              <p className="text-sm text-muted-foreground">
                Current key: {config.providers.anthropic.apiKey || "Not set"}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="Anthropic API Key"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.anthropicApiKey}
                  onChange={(e) => setForm({ ...form, anthropicApiKey: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Model (e.g. claude-3-5-sonnet)"
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground"
                  value={form.anthropicModel}
                  onChange={(e) => setForm({ ...form, anthropicModel: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
