"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, MessageSquare, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type AgentSettings = {
    tone_preference: string;
    value_propositions: string;
    forbidden_words: string;
};

const AGENT_SETTING_KEYS = ["tone_preference", "value_propositions", "forbidden_words"] as const;

function isAgentSettingKey(key: unknown): key is keyof AgentSettings {
    return typeof key === "string" && AGENT_SETTING_KEYS.includes(key as keyof AgentSettings);
}

export default function AgentSettingsPage() {
    const [settings, setSettings] = useState<AgentSettings>({
        tone_preference: "",
        value_propositions: "",
        forbidden_words: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(getBrowserApiUrl("/settings/agent"));
                const data = await res.json();
                if (Array.isArray(data)) {
                    const newSettings = { ...settings };
                    data.forEach((m: any) => {
                        const key = m?.key;
                        if (isAgentSettingKey(key) && typeof m.value === "string") {
                            newSettings[key] = m.value;
                        }
                    });
                    setSettings(newSettings);
                }
            } catch (error) {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (key: string, value: string) => {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiUrl("/settings/agent"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
            });
            if (res.ok) {
                toast.success(`Updated ${key.replace('_', ' ')}`);
            } else {
                throw new Error();
            }
        } catch (error) {
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader
                title="AI Sales Agent"
                subtitle="Configure how your AI agent behaves and interacts with leads."
            />

            <div className="grid gap-6">
                {/* Tone Preference */}
                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold">
                        <MessageSquare className="w-5 h-5" />
                        <h3>Tone of Voice</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Describe the personality of your agent (e.g., Professional, friendly, persistent).</p>
                    <div className="flex gap-4">
                        <textarea
                            value={settings.tone_preference}
                            onChange={(e) => setSettings({ ...settings, tone_preference: e.target.value })}
                            className="flex-1 bg-muted border border-border rounded-xl p-3 text-foreground focus:outline-none focus:border-purple-500 h-24"
                            placeholder="Example: Keep it professional but witty. Use clear, concise language."
                        />
                        <button
                            onClick={() => handleSave("tone_preference", settings.tone_preference)}
                            disabled={saving}
                            className="self-end p-3 bg-purple-600 rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            <Save className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </GlassCard>

                {/* Value Propositions */}
                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold">
                        <Sparkles className="w-5 h-5" />
                        <h3>Core Value Propositions</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">What are the key points the AI should emphasize in its outreach?</p>
                    <div className="flex gap-4">
                        <textarea
                            value={settings.value_propositions}
                            onChange={(e) => setSettings({ ...settings, value_propositions: e.target.value })}
                            className="flex-1 bg-muted border border-border rounded-xl p-3 text-foreground focus:outline-none focus:border-blue-500 h-32"
                            placeholder="Example: We reduce outreach time by 70%. We provide 99% accurate lead data."
                        />
                        <button
                            onClick={() => handleSave("value_propositions", settings.value_propositions)}
                            disabled={saving}
                            className="self-end p-3 bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            <Save className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </GlassCard>

                {/* Forbidden Words */}
                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 font-semibold">
                        <AlertCircle className="w-5 h-5" />
                        <h3>Guardrails (Negative Constraints)</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Words, topics, or phrases the agent should never mention.</p>
                    <div className="flex gap-4">
                        <textarea
                            value={settings.forbidden_words}
                            onChange={(e) => setSettings({ ...settings, forbidden_words: e.target.value })}
                            className="flex-1 bg-muted border border-border rounded-xl p-3 text-foreground focus:outline-none focus:border-red-500 h-24"
                            placeholder="Example: Never mention pricing in the first email. Avoid using the word 'partnership'."
                        />
                        <button
                            onClick={() => handleSave("forbidden_words", settings.forbidden_words)}
                            disabled={saving}
                            className="self-end p-3 bg-red-600 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                        >
                            <Save className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
