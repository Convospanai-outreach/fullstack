"use client";

import { useState } from "react";
import ScrapeForm from "./components/ScrapeForm";
import ScrapeResult from "./components/ScrapeResult";

export default function ScraperPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleScrape = async (request: any) => {
        setLoading(true);
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/scraper-bridge/scrape", {
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
        <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
            <h1>Web Scraper</h1>
            <ScrapeForm onSubmit={handleScrape} loading={loading} />
            {result && <ScrapeResult result={result} />}
        </div>
    );
}
