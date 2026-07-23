"use client";

import { useEffect, useState } from "react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        apiKeyOpenAI: "",
        apiKeyGemini: "",
        apiKeyGroq: "",
        apiKeyAnthropic: "",
        hubspotApiKey: "",
        liCookie: "",
        notifications: { emailGlobal: true, emailCampaign: true, emailLeads: true, inAppGlobal: true }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [settingsRes, notificationsRes] = await Promise.all([
                    fetch(getBrowserApiUrl("/settings")),
                    fetch(getBrowserApiUrl("/settings/notifications"))
                ]);

                if (!settingsRes.ok) throw new Error("Failed to load settings");
                const settingsData = await settingsRes.json();
                const notificationsData = notificationsRes.ok ? await notificationsRes.json() : {};

                setSettings((prev: any) => ({
                    ...prev,
                    apiKeyOpenAI: settingsData.apiKeyOpenAI || "",
                    apiKeyGemini: settingsData.apiKeyGemini || "",
                    apiKeyGroq: settingsData.apiKeyGroq || "",
                    apiKeyAnthropic: settingsData.apiKeyAnthropic || "",
                    hubspotApiKey: settingsData.hubspotApiKey || "",
                    liCookie: settingsData.liCookie || "",
                    notifications: {
                        emailGlobal: notificationsData.emailGlobal ?? true,
                        emailCampaign: notificationsData.emailCampaign ?? true,
                        emailLeads: notificationsData.emailLeads ?? true,
                        inAppGlobal: notificationsData.inAppGlobal ?? true
                    }
                }));
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(getBrowserApiUrl("/settings"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKeyOpenAI: settings.apiKeyOpenAI,
                    apiKeyGemini: settings.apiKeyGemini,
                    apiKeyGroq: settings.apiKeyGroq,
                    apiKeyAnthropic: settings.apiKeyAnthropic,
                    hubspotApiKey: settings.hubspotApiKey,
                    liCookie: settings.liCookie
                })
            });
            if (!res.ok) throw new Error("Failed to save settings");

            const notifRes = await fetch(getBrowserApiUrl("/settings/notifications"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings.notifications)
            });
            if (!notifRes.ok) throw new Error("Failed to save notification settings");
            setMessage({ type: "success", text: "Settings saved successfully!" });
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: "Failed to save settings. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-white">Loading settings...</div>;

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

            {message && (
                <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass p-6 rounded-xl border border-white/10 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-1">AI Provider Keys</h3>
                    <p className="text-xs text-gray-400 mb-4">Configure credentials for AI draft generation, email enrichment, and strategic analysis.</p>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="settings-gemini-key" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                Google Gemini API Key
                            </label>
                            <input
                                id="settings-gemini-key"
                                type="password"
                                placeholder="AIzaSy..."
                                value={settings.apiKeyGemini}
                                onChange={(e) => setSettings({ ...settings, apiKeyGemini: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="settings-openai-key" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                OpenAI API Key
                            </label>
                            <input
                                id="settings-openai-key"
                                type="password"
                                placeholder="sk-..."
                                value={settings.apiKeyOpenAI}
                                onChange={(e) => setSettings({ ...settings, apiKeyOpenAI: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="settings-groq-key" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                Groq API Key
                            </label>
                            <input
                                id="settings-groq-key"
                                type="password"
                                placeholder="gsk_..."
                                value={settings.apiKeyGroq}
                                onChange={(e) => setSettings({ ...settings, apiKeyGroq: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="settings-anthropic-key" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                Anthropic Claude API Key
                            </label>
                            <input
                                id="settings-anthropic-key"
                                type="password"
                                placeholder="sk-ant-..."
                                value={settings.apiKeyAnthropic}
                                onChange={(e) => setSettings({ ...settings, apiKeyAnthropic: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-1">Integrations</h3>
                    <div className="space-y-4 mt-3">
                        <div>
                            <label htmlFor="settings-hubspot-key" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                HubSpot API Key
                            </label>
                            <input
                                id="settings-hubspot-key"
                                type="password"
                                value={settings.hubspotApiKey}
                                onChange={(e) => setSettings({ ...settings, hubspotApiKey: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="settings-linkedin-cookie" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                                LinkedIn Cookie
                            </label>
                            <input
                                id="settings-linkedin-cookie"
                                type="password"
                                value={settings.liCookie}
                                onChange={(e) => setSettings({ ...settings, liCookie: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Notifications</h3>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <input
                                id="settings-email-global"
                                type="checkbox"
                                checked={settings.notifications.emailGlobal}
                                onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailGlobal: e.target.checked } })}
                                className="rounded border-white/10 bg-white/5"
                            />
                            <label htmlFor="settings-email-global" className="text-sm text-gray-300">
                                Email Notifications (Global)
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="settings-email-campaign"
                                type="checkbox"
                                checked={settings.notifications.emailCampaign}
                                onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailCampaign: e.target.checked } })}
                                className="rounded border-white/10 bg-white/5"
                            />
                            <label htmlFor="settings-email-campaign" className="text-sm text-gray-300">
                                Email Notifications (Campaigns)
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="settings-email-leads"
                                type="checkbox"
                                checked={settings.notifications.emailLeads}
                                onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailLeads: e.target.checked } })}
                                className="rounded border-white/10 bg-white/5"
                            />
                            <label htmlFor="settings-email-leads" className="text-sm text-gray-300">
                                Email Notifications (Leads)
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="settings-inapp-global"
                                type="checkbox"
                                checked={settings.notifications.inAppGlobal}
                                onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, inAppGlobal: e.target.checked } })}
                                className="rounded border-white/10 bg-white/5"
                            />
                            <label htmlFor="settings-inapp-global" className="text-sm text-gray-300">
                                In-App Notifications
                            </label>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-lg bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300 disabled:opacity-70 disabled:cursor-not-allowed transition"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
