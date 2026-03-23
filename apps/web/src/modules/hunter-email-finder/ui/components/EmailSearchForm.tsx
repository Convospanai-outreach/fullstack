"use client";

import { useState } from "react";

type Props = {
    onSubmit: (data: any) => void;
    loading: boolean;
};

export default function EmailSearchForm({ onSubmit, loading }: Props) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [domain, setDomain] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ firstName, lastName, domain });
    };

    return (
        <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 24, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    First Name
                </label>
                <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    placeholder="John"
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Last Name
                </label>
                <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    placeholder="Doe"
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Company Domain
                </label>
                <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    placeholder="example.com"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                style={{
                    padding: "10px 20px",
                    background: loading ? "#9ca3af" : "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                }}
            >
                {loading ? "Searching..." : "Find Email"}
            </button>
        </form>
    );
}
