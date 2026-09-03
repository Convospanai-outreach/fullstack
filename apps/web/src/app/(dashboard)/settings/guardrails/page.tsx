"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    Shield,
    Lock,
    AlertTriangle,
    Regex,
    Save,
    X,
    Plus
} from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function GuardrailsPage() {
    const [config, setConfig] = useState<any>({
        blocklist: [],
        allowlist: [],
        regexRules: [],
        competitorMentions: [],
        detectPII: true,
        strictness: 'medium'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Temp inputs
    const [newKeyword, setNewKeyword] = useState("");
    const [newCompetitor, setNewCompetitor] = useState("");
    const [newRegex, setNewRegex] = useState("");

    useEffect(() => {
        fetch(getBrowserApiBase() + "/settings/guardrails")
            .then(res => res.json())
            .then(data => {
                // Ensure arrays initialized
                setConfig({
                    ...data,
                    blocklist: data.blocklist || [],
                    competitorMentions: data.competitorMentions || [],
                    regexRules: data.regexRules || []
                });
                setLoading(false);
            })
            .catch(() => {
                toast.error("Failed to load guardrails");
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/guardrails", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                toast.success("Safety policies updated");
            } else {
                throw new Error("Failed to save");
            }
        } catch (err) {
            toast.error("Error saving policy");
        } finally {
            setSaving(false);
        }
    };

    const addItem = (field: string, value: string, setter: any) => {
        if (!value.trim()) return;
        const currentCheck = config[field] || [];
        if (currentCheck.includes(value)) {
            toast.error("Item already exists");
            return;
        }
        setConfig({ ...config, [field]: [...currentCheck, value] });
        setter("");
    };

    const removeItem = (field: string, index: number) => {
        const newArr = [...config[field]];
        newArr.splice(index, 1);
        setConfig({ ...config, [field]: newArr });
    };

    if (loading) return <div className="p-8 text-foreground">Loading safety protocols...</div>;

    return (
        <div className="space-y-8 max-w-4xl">
            <SectionHeader
                title="AI Guardrails"
                subtitle="Define safety boundaries and active blocking rules for your agents."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PII & Sensitivity */}
                <GlassCard className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-foreground">Core Safety</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-foreground">PII Detection</div>
                                <div className="text-xs text-muted-foreground">Block emails & phone numbers</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={config.detectPII}
                                    onChange={(e) => setConfig({ ...config, detectPII: e.target.checked })}
                                />
                                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-bold text-foreground">Sensitivity Level</div>
                            <select
                                value={config.strictness}
                                onChange={(e) => setConfig({ ...config, strictness: e.target.value })}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                            >
                                <option value="low">Low (Permissive)</option>
                                <option value="medium">Medium (Standard)</option>
                                <option value="high">High (Strict)</option>
                            </select>
                        </div>
                    </div>
                </GlassCard>

                {/* Keyword Blocklist */}
                <GlassCard className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <Lock className="w-5 h-5 text-red-400" />
                        <h3 className="font-bold text-foreground">Blocked Keywords</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('blocklist', newKeyword, setNewKeyword)}
                                placeholder="Add word to block..."
                                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-red-500"
                            />
                            <button
                                onClick={() => addItem('blocklist', newKeyword, setNewKeyword)}
                                className="p-2 bg-muted hover:bg-accent rounded-lg text-foreground"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                            {config.blocklist.map((word: string, idx: number) => (
                                <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs">
                                    {word}
                                    <button onClick={() => removeItem('blocklist', idx)}><X className="w-3 h-3 hover:text-foreground" /></button>
                                </span>
                            ))}
                            {config.blocklist.length === 0 && <span className="text-xs text-muted-foreground italic">No blocked words</span>}
                        </div>
                    </div>
                </GlassCard>

                {/* Competitor Watch */}
                <GlassCard className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <h3 className="font-bold text-foreground">Competitor Watch</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                value={newCompetitor}
                                onChange={(e) => setNewCompetitor(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('competitorMentions', newCompetitor, setNewCompetitor)}
                                placeholder="Add competitor name..."
                                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber-500"
                            />
                            <button
                                onClick={() => addItem('competitorMentions', newCompetitor, setNewCompetitor)}
                                className="p-2 bg-muted hover:bg-accent rounded-lg text-foreground"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {config.competitorMentions.map((word: string, idx: number) => (
                                <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">
                                    {word}
                                    <button onClick={() => removeItem('competitorMentions', idx)}><X className="w-3 h-3 hover:text-foreground" /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </GlassCard>

                {/* Advanced Regex */}
                <GlassCard className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <Regex className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-foreground">Custom Patterns (Regex)</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                value={newRegex}
                                onChange={(e) => setNewRegex(e.target.value)}
                                placeholder="e.g. ^CONFIDENTIAL.*"
                                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-purple-500"
                            />
                            <button
                                onClick={() => addItem('regexRules', newRegex, setNewRegex)}
                                className="p-2 bg-muted hover:bg-accent rounded-lg text-foreground"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {config.regexRules.map((rule: string, idx: number) => (
                                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-purple-500/5 border border-purple-500/10 rounded text-xs font-mono text-foreground">
                                    {rule}
                                    <button onClick={() => removeItem('regexRules', idx)}><X className="w-3 h-3 hover:text-foreground" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving Policies..." : "Enforce Policies"}
                </button>
            </div>
        </div>
    );
}
