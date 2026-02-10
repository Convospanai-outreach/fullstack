"use client";

import { useEffect, useState } from "react";
import StatCard from "@/modules/dashboard/ui/components/StatCard";


export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/analytics/stats");
                const json = await res.json();
                if (json.ok) setData(json.stats);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div style={{ padding: 24 }}>Loading analytics...</div>;
    if (!data) return <div style={{ padding: 24 }}>No data available</div>;

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Analytics</h1>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
                <StatCard title="Total Leads" value={data.overview.totalLeads} hint="All time" />
                <StatCard title="Total Campaigns" value={data.overview.totalCampaigns} hint="All time" />
                <StatCard title="Emails Sent" value={data.overview.emailStats.sent} hint="Total sent" />
                <StatCard title="Open Rate" value={`${data.overview.emailStats.openRate.toFixed(1)}%`} hint="Average" />
            </div>

            <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Campaign Performance</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                            <th style={{ padding: 12 }}>Campaign</th>
                            <th style={{ padding: 12 }}>Status</th>
                            <th style={{ padding: 12 }}>Progress</th>
                            <th style={{ padding: 12 }}>Completion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.campaignPerformance.map((c: any) => (
                            <tr key={c.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                                <td style={{ padding: 12, fontWeight: 500 }}>{c.name}</td>
                                <td style={{ padding: 12 }}>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: 4,
                                        fontSize: 12,
                                        background: c.status === "active" ? "#dcfce7" : "#f3f4f6",
                                        color: c.status === "active" ? "#166534" : "#374151"
                                    }}>
                                        {c.status}
                                    </span>
                                </td>
                                <td style={{ padding: 12 }}>
                                    {c.completedCount} / {c.targetCount}
                                </td>
                                <td style={{ padding: 12 }}>
                                    {c.targetCount > 0 ? Math.round((c.completedCount / c.targetCount) * 100) : 0}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
