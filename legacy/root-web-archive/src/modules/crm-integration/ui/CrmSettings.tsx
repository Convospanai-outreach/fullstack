"use client";

import { useState } from "react";

export default function CrmSettings() {
    const [provider, setProvider] = useState("hubspot");
    const [apiKey, setApiKey] = useState("");
    const [connected, setConnected] = useState(false);

    const handleConnect = () => {
        // Mock connection
        if (apiKey) {
            setConnected(true);
            alert(`Connected to ${provider} successfully!`);
        }
    };

    return (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>CRM Integration</h3>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Provider</label>
                <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                >
                    <option value="hubspot">HubSpot</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="pipedrive">Pipedrive</option>
                </select>
            </div>

            <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>API Key / Access Token</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your CRM API key"
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
            </div>

            <button
                onClick={handleConnect}
                style={{
                    padding: "10px 20px",
                    background: connected ? "#16a34a" : "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600
                }}
            >
                {connected ? "Connected" : "Connect CRM"}
            </button>
        </div>
    );
}
