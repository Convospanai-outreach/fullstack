"use client";

import { useEffect, useState } from "react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

type CrmIntegration = {
    id: string;
    provider: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: string | null;
    isActive: boolean;
};

export default function CrmSettings() {
    const [provider, setProvider] = useState("HUBSPOT");
    const [accessToken, setAccessToken] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_URL}/settings/crm`);
                if (!res.ok) throw new Error("Failed to fetch CRM settings");
                const data: CrmIntegration[] = await res.json();
                const integration = data.find((i) => i.provider === provider);
                if (integration) {
                    setAccessToken("");
                    setRefreshToken("");
                    setExpiresAt(integration.expiresAt ? new Date(integration.expiresAt).toISOString().slice(0, 16) : "");
                    setIsActive(!!integration.isActive);
                    setConnected(true);
                } else {
                    setConnected(false);
                }
            } catch (e: any) {
                setError(e?.message || "Failed to load CRM settings");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [provider]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`${API_URL}/settings/crm`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    accessToken: accessToken || undefined,
                    refreshToken: refreshToken || undefined,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                    isActive,
                    fieldMapping: undefined,
                    syncSettings: undefined
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to save CRM settings");
            }
            setConnected(true);
        } catch (e: any) {
            setError(e?.message || "Failed to save CRM settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>CRM Integration</h3>

            {loading && <div style={{ color: "#6b7280", marginBottom: 12 }}>Loading...</div>}
            {!loading && (
                <div style={{ color: connected ? "#16a34a" : "#6b7280", marginBottom: 12, fontWeight: 600 }}>
                    {connected ? "Connected" : "Not connected"}
                </div>
            )}
            {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Provider</label>
                <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                >
                    <option value="HUBSPOT">HubSpot</option>
                </select>
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Access Token</label>
                <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Paste your HubSpot access token"
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Refresh Token (optional)</label>
                <input
                    type="password"
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)}
                    placeholder="Optional refresh token"
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Token Expiry (optional)</label>
                <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
            </div>

            <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    id="crm-active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="crm-active" style={{ fontSize: 14, fontWeight: 500 }}>
                    Integration active
                </label>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                style={{
                    padding: "10px 20px",
                    background: saving ? "#94a3b8" : "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: saving ? "default" : "pointer",
                    fontWeight: 600
                }}
            >
                {saving ? "Saving..." : "Save CRM Settings"}
            </button>
        </div>
    );
}
