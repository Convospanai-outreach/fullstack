"use client";

import { useState } from "react";
import { Sparkles, Target, Loader2, Save } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ICPBuilderPage() {
    const [_step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [result, setResult] = useState<{ keywords: string[], booleanString: string, personaHook: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [formData, setFormData] = useState({
        industry: "",
        role: "",
        size: "",
        painPoints: ""
    });

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/agents/icp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to generate ICP");
            }

            const data = await res.json();
            setResult(data);
            setGenerated(true);
            setSaved(false);
            setStep(2);
            toast.success("Ideal Customer Profile generated!");
        } catch (error: any) {
            console.error("ICP Generation failed", error);
            toast.error(error.message || "Failed to generate ICP");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!result) return;
        setSaving(true);
        try {
            const name = [formData.industry, formData.role].filter(Boolean).join(" – ") || "ICP Profile";
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/icp-builder/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description: formData.painPoints || undefined,
                    criteria: { ...formData, ...result },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok === false) {
                throw new Error(data?.error || "Failed to save profile");
            }
            setSaved(true);
            toast.success("Profile saved");
        } catch (error: any) {
            toast.error(error.message || "Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
                    <Target className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">ICP Builder</h1>
                    <p className="text-gray-400">Define your perfect customer profile using AI</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left: Input Form */}
                <div className="md:col-span-2 space-y-6">
                    <GlassCard className="p-8 space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white">Target Criteria</h2>
                            <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                                <Sparkles className="w-3 h-3" />
                                AI-Powered
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Target Industry</label>
                                <input
                                    type="text"
                                    placeholder="e.g. B2B SaaS, FinTech, Healthcare"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Decision Maker Role</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. CTO, VP of Sales"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Company Size</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none"
                                        value={formData.size}
                                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                    >
                                        <option value="">Select size...</option>
                                        <option value="1-10">1-10 employees</option>
                                        <option value="11-50">11-50 employees</option>
                                        <option value="51-200">51-200 employees</option>
                                        <option value="201-500">201-500 employees</option>
                                        <option value="500+">500+ employees</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">What problem do you solve for them?</label>
                                <textarea
                                    placeholder="e.g. They spend too much time manually updating spreadsheets..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors h-24 resize-none"
                                    value={formData.painPoints}
                                    onChange={(e) => setFormData({ ...formData, painPoints: e.target.value })}
                                />
                            </div>
                        </div>

                        <Button
                            variant="default"
                            className="w-full py-4 text-lg font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-lg shadow-purple-500/25"
                            onClick={handleGenerate}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating Profile...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" />
                                    Generate ICP
                                </span>
                            )}
                        </Button>
                    </GlassCard>
                </div>

                {/* Right: Results Preview */}
                <div className="space-y-6">
                    <div className={`transition - all duration - 500 ${generated && result ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4'} `}>
                        <h3 className="text-lg font-medium text-white mb-4">AI Analysis Results</h3>

                        {generated && result ? (
                            <div className="space-y-4">
                                <GlassCard className="p-4 border-l-4 border-l-green-500">
                                    <div className="text-sm text-gray-400 mb-1">Recommended Keywords</div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.keywords.map(k => (
                                            <span key={k} className="px-2 py-1 rounded bg-white/10 text-xs text-white border border-white/10">{k}</span>
                                        ))}
                                    </div>
                                </GlassCard>

                                <GlassCard className="p-4 border-l-4 border-l-blue-500">
                                    <div className="text-sm text-gray-400 mb-1">Boolean Search String</div>
                                    <code className="block text-xs text-blue-300 p-2 bg-black/20 rounded border border-white/5 mt-2 font-mono break-all">
                                        {result.booleanString}
                                    </code>
                                </GlassCard>

                                <GlassCard className="p-4 border-l-4 border-l-purple-500">
                                    <div className="text-sm text-gray-400 mb-1">Generated Persona Hook</div>
                                    <p className="text-sm text-gray-300 italic mt-2">
                                        "{result.personaHook}"
                                    </p>
                                </GlassCard>

                                <Button className="w-full mt-4" variant="outline" onClick={handleSaveProfile} disabled={saving || saved}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {saving ? "Saving..." : saved ? "Saved" : "Save Profile"}
                                </Button>
                            </div>
                        ) : (
                            <div className="h-64 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-6 text-gray-500">
                                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                                <p>Fill out the form and hit Generate to see AI magic.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
