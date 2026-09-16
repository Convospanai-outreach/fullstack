"use client";

import { useState } from "react";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { SectionHeader } from "@/components/ui/SectionHeader";
import CrystalSearchForm from "./components/CrystalSearchForm";
import CrystalResult from "./components/CrystalResult";

export default function CrystalLookupPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (data: Record<string, string>) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(getBrowserApiBase() + "/crystal-knows/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
            setResult(json);
        } catch (e: any) {
            setError(e.message || "Search failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-12">
            <SectionHeader
                title="Personality Lookup"
                subtitle="Find a person's DISC personality profile via Crystal Knows to tailor outreach tone and structure."
            />

            <CrystalSearchForm onSubmit={handleSearch} loading={loading} />

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs p-4">
                    {error}
                </div>
            )}

            {result && <CrystalResult result={result} />}
        </div>
    );
}
