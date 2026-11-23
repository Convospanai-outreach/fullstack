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
        <form onSubmit={handleSubmit} style={{ background: "hsl(var(--card))", padding: 24, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ marginBottom: 16 }}>
                <label htmlFor="hunter-first-name" style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                    First Name
                </label>
                <input
                    id="hunter-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: '1px solid hsl(var(--border))', borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                    placeholder="John"
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label htmlFor="hunter-last-name" style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                    Last Name
                </label>
                <input
                    id="hunter-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: '1px solid hsl(var(--border))', borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                    placeholder="Doe"
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <label htmlFor="hunter-domain" style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                    Company Domain
                </label>
                <input
                    id="hunter-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: '1px solid hsl(var(--border))', borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                    placeholder="example.com"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                style={{
                    padding: "10px 20px",
                    background: loading ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
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
