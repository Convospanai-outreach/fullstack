"use client";

import { useEffect, useState } from "react";

export default function OnboardingChecklist() {
    const [progress, setProgress] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        fetch(process.env.NEXT_PUBLIC_API_URL + "/onboarding/progress")
            .then(res => res.json())
            .then(json => {
                if (json.ok) setProgress(json.progress);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return null;
    if (!progress) return null;
    if (progress.percentComplete === 100) return null; // Hide if done

    if (minimized) {
        return (
            <div
                onClick={() => setMinimized(false)}
                style={{ position: "fixed", bottom: 20, right: 20, background: "#3b82f6", color: "#fff", padding: "12px 16px", borderRadius: 30, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", fontWeight: 600, zIndex: 1000 }}
            >
                🚀 Get Started ({progress.percentComplete}%)
            </div>
        );
    }

    return (
        <div style={{ position: "fixed", bottom: 20, right: 20, width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", zIndex: 1000, overflow: "hidden", border: "1px solid #e5e7eb" }}>
            <div style={{ background: "#3b82f6", padding: "16px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: 16 }}>Getting Started</h4>
                <button
                    onClick={() => setMinimized(true)}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}
                >
                    −
                </button>
            </div>

            <div style={{ padding: "16px 16px 8px" }}>
                <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress.percentComplete}%`, background: "#10b981", transition: "width 0.5s ease" }}></div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {progress.steps?.map((step: any) => (
                        <li key={step.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, opacity: step.completed ? 0.5 : 1 }}>
                            <div style={{
                                width: 20, height: 20, borderRadius: "50%",
                                border: step.completed ? "none" : "2px solid #d1d5db",
                                background: step.completed ? "#10b981" : "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 12
                            }}>
                                {step.completed && "✓"}
                            </div>
                            <span style={{ fontSize: 14, textDecoration: step.completed ? "line-through" : "none" }}>{step.label}</span>
                        </li>
                    )) || (
                        <li style={{ fontSize: 14, color: "#6b7280" }}>Initializing steps...</li>
                    )}
                </ul>
            </div>
        </div>
    );
}
