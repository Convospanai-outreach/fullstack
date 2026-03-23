"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        apiKeyOpenAI: "",
        apiKeyGemini: "",
        hubspotApiKey: "",
        liCookie: "",
        notifications: { emailGlobal: true, emailCampaign: true, emailLeads: true, inAppGlobal: true }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [settingsRes, notificationsRes] = await Promise.all([
                    fetch(process.env["NEXT_PUBLIC_API_URL"] + "/settings"),
                    fetch(process.env["NEXT_PUBLIC_API_URL"] + "/settings/notifications")
                ]);

                if (!settingsRes.ok) throw new Error("Failed to load settings");
                const settingsData = await settingsRes.json();
                const notificationsData = notificationsRes.ok ? await notificationsRes.json() : {};

                setSettings((prev: any) => ({
                    ...prev,
                    apiKeyOpenAI: settingsData.apiKeyOpenAI || "",
                    apiKeyGemini: settingsData.apiKeyGemini || "",
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
        try {
            const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKeyOpenAI: settings.apiKeyOpenAI,
                    apiKeyGemini: settings.apiKeyGemini,
                    hubspotApiKey: settings.hubspotApiKey,
                    liCookie: settings.liCookie
                })
            });
            if (!res.ok) throw new Error("Failed to save settings");

            const notifRes = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/settings/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings.notifications)
            });
            if (!notifRes.ok) throw new Error("Failed to save notification settings");
            alert("Settings saved!");
        } catch (error) {
            console.error(error);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-white">Loading settings...</div>;

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

            <form onSubmit={handleSubmit} className="glass p-6 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">API Keys</h3>

                <div className="mb-4">
                    <label htmlFor="settings-openai-key" className="block mb-2 text-sm font-medium text-gray-300">
                        OpenAI API Key
                    </label>
                    <input
                        id="settings-openai-key"
                        type="password"
                        value={settings.apiKeyOpenAI}
                        onChange={(e) => setSettings({ ...settings, apiKeyOpenAI: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="settings-gemini-key" className="block mb-2 text-sm font-medium text-gray-300">
                        Gemini API Key
                    </label>
                    <input
                        id="settings-gemini-key"
                        type="password"
                        value={settings.apiKeyGemini}
                        onChange={(e) => setSettings({ ...settings, apiKeyGemini: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="settings-hubspot-key" className="block mb-2 text-sm font-medium text-gray-300">
                        HubSpot API Key
                    </label>
                    <input
                        id="settings-hubspot-key"
                        type="password"
                        value={settings.hubspotApiKey}
                        onChange={(e) => setSettings({ ...settings, hubspotApiKey: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="settings-linkedin-cookie" className="block mb-2 text-sm font-medium text-gray-300">
                        LinkedIn Cookie
                    </label>
                    <input
                        id="settings-linkedin-cookie"
                        type="password"
                        value={settings.liCookie}
                        onChange={(e) => setSettings({ ...settings, liCookie: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                </div>

                <h3 className="text-lg font-semibold text-white mb-4">Notifications</h3>

                <div className="mb-3 flex items-center gap-2">
                    <input
                        id="settings-email-global"
                        type="checkbox"
                        checked={settings.notifications.emailGlobal}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailGlobal: e.target.checked } })}
                    />
                    <label htmlFor="settings-email-global" className="text-sm text-gray-300">
                        Email Notifications (Global)
                    </label>
                </div>

                <div className="mb-3 flex items-center gap-2">
                    <input
                        id="settings-email-campaign"
                        type="checkbox"
                        checked={settings.notifications.emailCampaign}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailCampaign: e.target.checked } })}
                    />
                    <label htmlFor="settings-email-campaign" className="text-sm text-gray-300">
                        Email Notifications (Campaigns)
                    </label>
                </div>

                <div className="mb-3 flex items-center gap-2">
                    <input
                        id="settings-email-leads"
                        type="checkbox"
                        checked={settings.notifications.emailLeads}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, emailLeads: e.target.checked } })}
                    />
                    <label htmlFor="settings-email-leads" className="text-sm text-gray-300">
                        Email Notifications (Leads)
                    </label>
                </div>

                <div className="mb-6 flex items-center gap-2">
                    <input
                        id="settings-inapp-global"
                        type="checkbox"
                        checked={settings.notifications.inAppGlobal}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, inAppGlobal: e.target.checked } })}
                    />
                    <label htmlFor="settings-inapp-global" className="text-sm text-gray-300">
                        In-App Notifications
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </form>
        </div>
    );
}
