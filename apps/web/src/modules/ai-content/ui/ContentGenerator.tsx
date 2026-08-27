"use client";

import { useState } from "react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function ContentGenerator({ lead, onDraftGenerated }: { lead: any, onDraftGenerated?: (draft: any) => void }) {
    const [loading, setLoading] = useState(false);
    const [draft, setDraft] = useState<any>(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/ai/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead }),
            });
            const json = await res.json();
            if (json.ok) {
                setDraft(json.draft);
                if (onDraftGenerated) onDraftGenerated(json.draft);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>AI Assistant</h4>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        background: "#7c3aed",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    {loading ? "Generating..." : "Generate Draft"}
                </button>
            </div>

            {draft && (
                <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid #eee" }}>
                    <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>Subject:</span>
                        <div style={{ fontSize: 14 }}>{draft.subject}</div>
                    </div>
                    <div>
                        <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>Body:</span>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "#374151" }}>{draft.body}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
