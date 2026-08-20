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
        <form onSubmit={handleSubmit} className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-sm mb-6">
            <div className="mb-4">
                <label htmlFor="scrape-target" className="block mb-2 text-sm font-semibold text-foreground">
                    Target
                </label>
                <select
                    id="scrape-target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                >
                    <option value="linkedin">LinkedIn Profile</option>
                    <option value="twitter">Twitter Profile</option>
                    <option value="generic">Generic Website</option>
                </select>
            </div>

            <div className="mb-6">
                <label htmlFor="scrape-url" className="block mb-2 text-sm font-semibold text-foreground">
                    URL
                </label>
                <input
                    id="scrape-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm placeholder:text-muted-foreground"
                    placeholder="https://linkedin.com/in/example"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-700"
            >
                {loading ? "Scraping..." : "Scrape"}
            </button>
        </form>
    );
}

