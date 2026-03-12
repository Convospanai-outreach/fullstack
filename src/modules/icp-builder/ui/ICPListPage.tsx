"use client";

import { useEffect, useState } from "react";
import ICPCard from "./components/ICPCard";

export default function ICPListPage() {
    const [icps, setIcps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(process.env.NEXT_PUBLIC_API_URL + "/icp-builder/list")
            .then((r) => r.json())
            .then((data) => {
                if (data.ok) setIcps(data.icps);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ padding: 24 }}>Loading ICPs...</div>;

    return (
        <main style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h1>Ideal Customer Profiles</h1>
                <a href="/icp-builder/new" style={{ padding: "8px 16px", background: "#0ea5e9", color: "#fff", borderRadius: 6, textDecoration: "none" }}>
                    Create New ICP
                </a>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {icps.map((icp) => (
                    <ICPCard key={icp.id} icp={icp} />
                ))}
            </div>
        </main>
    );
}
