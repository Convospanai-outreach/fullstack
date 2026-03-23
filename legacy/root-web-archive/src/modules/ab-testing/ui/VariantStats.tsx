"use client";

import { useEffect, useState } from "react";

export default function VariantStats() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(process.env['NEXT_PUBLIC_API_URL'] + "/ab-testing/track")
            .then(res => res.json())
            .then(json => {
                if (json.ok) setStats(json.stats);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div>Loading A/B stats...</div>;
    if (!stats) return null;

    const calculateRate = (part: number, total: number) => ((part / total) * 100).toFixed(1) + "%";

    return (
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <h4 style={{ margin: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>A/B Test Results</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#f9fafb", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>Variant A</div>
                    <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span>Opens:</span> <strong>{calculateRate(stats.A.opens, stats.A.sent)}</strong>
                    </div>
                    <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <span>Clicks:</span> <strong>{calculateRate(stats.A.clicks, stats.A.sent)}</strong>
                    </div>
                </div>
                <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 6, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: "#166534" }}>Variant B 🏆</div>
                    <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span>Opens:</span> <strong>{calculateRate(stats.B.opens, stats.B.sent)}</strong>
                    </div>
                    <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <span>Clicks:</span> <strong>{calculateRate(stats.B.clicks, stats.B.sent)}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
}
