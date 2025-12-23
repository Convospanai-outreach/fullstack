"use client";

import React, { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Shield, AlertTriangle, Lock } from 'lucide-react';

export default function GuardrailsPage() {
    const [config, setConfig] = useState<any>({
        blocklist: [],
        detectPII: true,
        strictness: "medium",
        maxDailyMsgs: 100
    });
    const [loading, setLoading] = useState(true);
    const [keywordInput, setKeywordInput] = useState("");

    useEffect(() => {
        fetch("/api/settings/guardrails")
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        try {
            const res = await fetch("/api/settings/guardrails", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            if (res.ok) toast.success("Guardrail policy updated");
            else toast.error("Failed to update policy");
        } catch (e) {
            toast.error("Error saving policy");
        }
    };

    const addKeyword = () => {
        if (!keywordInput.trim()) return;
        if (config.blocklist.includes(keywordInput.trim())) return;

        setConfig({
            ...config,
            blocklist: [...config.blocklist, keywordInput.trim()]
        });
        setKeywordInput("");
    };

    const removeKeyword = (word: string) => {
        setConfig({
            ...config,
            blocklist: config.blocklist.filter((w: string) => w !== word)
        });
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="space-y-8 max-w-4xl mr-auto">
            <SectionHeader
                title="AI Guardrails"
                subtitle="Configure safety rules and compliance policies"
            />

            <GlassCard className="p-6 space-y-6">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                    <div className="bg-red-500/20 p-3 rounded-xl">
                        <Shield className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Blocked Keywords</h3>
                        <p className="text-sm text-gray-400">Messages containing these words will be blocked automatically.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2 flex-1 text-white focus:outline-none focus:border-blue-500"
                            placeholder="Add blocked word (e.g. competitor name)"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                        />
                        <button
                            onClick={addKeyword}
                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-white font-medium"
                        >
                            Add
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {config.blocklist.map((word: string) => (
                            <span key={word} className="px-3 py-1 bg-red-900/40 text-red-200 border border-red-500/30 rounded-full text-sm flex items-center gap-2">
                                {word}
                                <button onClick={() => removeKeyword(word)} className="hover:text-white">×</button>
                            </span>
                        ))}
                        {config.blocklist.length === 0 && (
                            <span className="text-gray-500 text-sm italic">No blocked keywords configured.</span>
                        )}
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="p-6 space-y-6">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                    <div className="bg-blue-500/20 p-3 rounded-xl">
                        <Lock className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Data Protection (PII)</h3>
                        <p className="text-sm text-gray-400">Prevent sensitive information from being sent.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${config.detectPII ? "text-yellow-400" : "text-gray-600"}`} />
                        <div>
                            <div className="font-medium text-white">Block Credit Cards & SSNs</div>
                            <div className="text-xs text-gray-400">Scan messages for numeric patterns resembling PII.</div>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.detectPII}
                            onChange={(e) => setConfig({ ...config, detectPII: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </GlassCard>

            <GlassCard className="p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-white mb-2">Policy Strictness</h3>
                    <p className="text-sm text-gray-400 mb-4">How aggressively should AI evaluate tone?</p>

                    <div className="flex gap-4">
                        {['low', 'medium', 'high'].map(level => (
                            <button
                                key={level}
                                onClick={() => setConfig({ ...config, strictness: level })}
                                className={`flex-1 py-3 rounded-lg border capitalize ${config.strictness === level
                                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                                        : "bg-slate-900 border-white/10 text-gray-400 hover:bg-white/5"
                                    }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            </GlassCard>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}
