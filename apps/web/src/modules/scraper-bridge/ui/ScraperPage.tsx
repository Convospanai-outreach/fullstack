"use client";

import { useState } from "react";
import ScrapeForm from "./components/ScrapeForm";
import ScrapeResult from "./components/ScrapeResult";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function ScraperPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleScrape = async (request: any) => {
        setLoading(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/scraper-bridge/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });
            const data = await res.json();
            setResult(data.result);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Web Scraper</h1>
                <p className="mt-1 text-sm text-muted-foreground">Extract structured data from web profiles and URLs.</p>
            </div>
            <ScrapeForm onSubmit={handleScrape} loading={loading} />
            {result && <ScrapeResult result={result} />}
        </div>
    );
}

