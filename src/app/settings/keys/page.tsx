"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ApiKeysPage() {
    const { data: settings, error } = useSWR("/api/settings", fetcher);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ apiKeyOpenAI: "", apiKeyGemini: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            mutate("/api/settings"); // Refresh data
            setFormData({ apiKeyOpenAI: "", apiKeyGemini: "" }); // Clear inputs
            alert("Keys updated!");
        } catch (e) {
            alert("Failed to update keys");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">API Keys</h1>
                <p className="text-gray-400">Manage external integration keys.</p>
            </div>

            <div className="glass border border-white/10 rounded-xl p-8">
                <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">OpenAI Key</label>
                        <input
                            type="password"
                            placeholder={settings?.apiKeyOpenAI || "sk-..."}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.apiKeyOpenAI}
                            onChange={e => setFormData({ ...formData, apiKeyOpenAI: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Used for content generation variants.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Gemini Key</label>
                        <input
                            type="password"
                            placeholder={settings?.apiKeyGemini || "AI..."}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.apiKeyGemini}
                            onChange={e => setFormData({ ...formData, apiKeyGemini: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Used for campaign analysis and automations.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>
    );
}
