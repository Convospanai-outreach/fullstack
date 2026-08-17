"use client";

import { useState } from "react";
import EmailSearchForm from "./components/EmailSearchForm";
import EmailResult from "./components/EmailResult";

export default function EmailFinderPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (data: any) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/hunter-email-finder/find-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const json = await res.json();
            if (!json.ok) throw new Error(json.error);
            setResult(json.result);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
            <h1>Email Finder</h1>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
                Find professional email addresses using Hunter.io
            </p>

            <EmailSearchForm onSubmit={handleSearch} loading={loading} />

            {error && (
                <div style={{ padding: 16, background: "#fee2e2", color: "#991b1b", borderRadius: 8, marginTop: 16 }}>
                    {error}
                </div>
            )}

            {result && <EmailResult result={result} />}
        </div>
    );
}
