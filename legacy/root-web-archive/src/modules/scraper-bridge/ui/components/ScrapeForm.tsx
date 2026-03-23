"use client";

import { useState } from "react";

type Props = {
    onSubmit: (request: any) => void;
    loading: boolean;
};

export default function ScrapeForm({ onSubmit, loading }: Props) {
    const [target, setTarget] = useState("linkedin");
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ target, url, options: { screenshot: true } });
    };

    return (
        <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 24, borderRadius: 10, marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Target</label>
                <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                >
                    <option value="linkedin">LinkedIn Profile</option>
                    <option value="twitter">Twitter Profile</option>
                    <option value="generic">Generic Website</option>
                </select>
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>URL</label>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
                    placeholder="https://linkedin.com/in/example"
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
                }}
            >
                {loading ? "Scraping..." : "Scrape"}
            </button>
        </form>
    );
}
