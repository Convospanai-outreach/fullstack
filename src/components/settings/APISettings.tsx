"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface APISettingsData {
    apiKeyOpenAI?: string;
    apiKeyGemini?: string;
    liCookie?: string;
}

interface APISettingsProps {
    settings: APISettingsData | null;
    onUpdate: (data: APISettingsData) => Promise<void>;
}

export function APISettings({ settings, onUpdate }: APISettingsProps) {
    const [apiKeyOpenAI, setApiKeyOpenAI] = useState(settings?.apiKeyOpenAI || "");
    const [apiKeyGemini, setApiKeyGemini] = useState(settings?.apiKeyGemini || "");
    const [liCookie, setLiCookie] = useState(settings?.liCookie || "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onUpdate({ apiKeyOpenAI, apiKeyGemini, liCookie });
        setLoading(false);
    };

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">API Configuration</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">OpenAI API Key</label>
                    <input
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        placeholder="sk-..."
                        value={apiKeyOpenAI}
                        onChange={(e) => setApiKeyOpenAI(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Gemini API Key</label>
                    <input
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        placeholder="AIza..."
                        value={apiKeyGemini}
                        onChange={(e) => setApiKeyGemini(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">LinkedIn Cookie (li_at)</label>
                    <input
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        placeholder="AQED..."
                        value={liCookie}
                        onChange={(e) => setLiCookie(e.target.value)}
                    />
                </div>
                <Button variant="primary" disabled={loading}>
                    {loading ? "Saving..." : "Save Configuration"}
                </Button>
            </form>
        </GlassCard>
    );
}
