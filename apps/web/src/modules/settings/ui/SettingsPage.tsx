"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        hunterApiKey: "",
        openaiApiKey: "",
        notifications: { email: true, slack: false },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Mock fetch
        setTimeout(() => {
            setSettings({
                hunterApiKey: "hunter_...",
                openaiApiKey: "sk-...",
                notifications: { email: true, slack: false },
            });
            setLoading(false);
        }, 500);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        // Mock save
        setTimeout(() => {
            setSaving(false);
            alert("Settings saved!");
        }, 1000);
    };

    if (loading) return <div style={{ padding: 24 }}>Loading settings...</div>;

    return (
        <div style={{ padding: 24, maxWidth: 600 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Settings</h1>

            <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>API Keys</h3>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Hunter.io API Key</label>
                    <input
                        type="password"
                        value={settings.hunterApiKey}
                        onChange={(e) => setSettings({ ...settings, hunterApiKey: e.target.value })}
                        style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>OpenAI API Key</label>
                    <input
                        type="password"
                        value={settings.openaiApiKey}
                        onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                        style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    />
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Notifications</h3>

                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                        type="checkbox"
                        checked={settings.notifications.email}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, email: e.target.checked } })}
                    />
                    <label style={{ fontSize: 14 }}>Email Notifications</label>
                </div>

                <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                        type="checkbox"
                        checked={settings.notifications.slack}
                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, slack: e.target.checked } })}
                    />
                    <label style={{ fontSize: 14 }}>Slack Notifications</label>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        padding: "10px 20px",
                        background: "#0ea5e9",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: saving ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </form>
        </div>
    );
}
