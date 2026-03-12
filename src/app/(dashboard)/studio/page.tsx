"use client";

import { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ToneSlider } from '@/components/studio/ToneSlider';
import { Input } from '@/components/ui/Input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MessageControlStudio() {
    const [config, setConfig] = useState({
        formality: 75,
        directness: 40,
        talkingPoints: "",
        avoidWords: ""
    });

    const [preview, setPreview] = useState<string>(`Hi John,\n\nI noticed your recent work on the core payments infrastructure at Stripe. Impressive stuff.\n\nUsually, engineering leaders tell me that balancing security compliance with developer velocity is their biggest headache in Q3.\n\nSince we just achieved SOC2 Type II, I wanted to share how we help teams like yours offload the heavy lifting.\n\nOpen to a quick 15-min chat next Tuesday?\n\nBest,\nAlex`);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/studio/config");
                const data = await res.json();
                if (data.config) {
                    setConfig(data.config);
                }
            } catch (e) {
                console.error("Failed to load studio config", e);
            }
        };
        loadConfig();
    }, []);

    const handleRegenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/studio/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formality: config.formality,
                    directness: config.directness,
                    talkingPoints: config.talkingPoints ? config.talkingPoints.split('\n').map(s => s.trim()).filter(Boolean) : [],
                    avoidWords: config.avoidWords,
                })
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setPreview(json.response);
            toast.success("Message regenerated!");
        } catch (error: any) {
            toast.error(error.message || "Failed to generate preview");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/studio/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error("Failed to save");
            toast.success("Configuration saved globally!");
        } catch (e) {
            toast.error("Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
            {/* LEFT PANEL: CONTROLS */}
            <section className="lg:col-span-5 flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Message Studio</h1>
                    <p className="text-text-secondary">Fine-tune your AI agent's voice and constraints.</p>
                </div>

                <GlassCard className="flex flex-col gap-6">
                    <h2 className="text-lg font-semibold text-text-primary border-b border-border-subtle pb-3">Voice & Tone</h2>

                    <ToneSlider
                        label="Formality"
                        leftLabel="Casual"
                        rightLabel="Formal"
                        defaultValue={config.formality}
                        onChange={(val) => setConfig(prev => ({ ...prev, formality: val }))}
                    />

                    <ToneSlider
                        label="Directness"
                        leftLabel="Consultative"
                        rightLabel="Direct"
                        defaultValue={config.directness}
                        onChange={(val) => setConfig(prev => ({ ...prev, directness: val }))}
                    />
                </GlassCard>

                <GlassCard className="flex flex-col gap-6 flex-1">
                    <h2 className="text-lg font-semibold text-text-primary border-b border-border-subtle pb-3">Constraints</h2>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary">Key Talking Points</label>
                        <textarea
                            className="w-full bg-bg-base/50 border border-border-subtle rounded-lg p-3 text-sm text-text-primary focus:border-accent-blue outline-none min-h-[100px]"
                            placeholder="• Mention our new SOC2 compliance&#10;• Ask about their Q3 roadmap"
                            value={config.talkingPoints}
                            onChange={(e) => setConfig(prev => ({ ...prev, talkingPoints: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary">Avoid Words</label>
                        <Input
                            placeholder="synergy, hack, cheap"
                            value={config.avoidWords}
                            onChange={(e) => setConfig(prev => ({ ...prev, avoidWords: e.target.value }))}
                        />
                    </div>
                </GlassCard>
            </section>

            {/* RIGHT PANEL: PREVIEW */}
            <section className="lg:col-span-7 flex flex-col h-full">
                <GlassCard className="h-full flex flex-col relative overflow-hidden bg-gradient-to-br from-bg-glass to-bg-glassStrong">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-text-primary">Live Preview</h2>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 rounded-full text-xs font-medium bg-accent-blue/20 text-accent-blue border border-accent-blue/30">LinkedIn</button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-text-secondary hover:bg-white/5 transition">Email</button>
                        </div>
                    </div>

                    {/* Email UI Mockup */}
                    <div className="flex-1 bg-bg-base rounded-lg border border-border-subtle p-6 shadow-inner font-mono text-sm leading-relaxed text-text-primary opacity-90 whitespace-pre-wrap overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
                            </div>
                        ) : (
                            preview
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={handleRegenerate}
                            className="px-4 py-2 text-text-muted hover:text-text-primary transition disabled:opacity-50"
                            disabled={loading}
                        >
                            Regenerate
                        </button>
                        <PrimaryButton disabled={loading || saving} onClick={handleSave}>
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </PrimaryButton>
                    </div>
                </GlassCard>
            </section>
        </div>
    );
}
