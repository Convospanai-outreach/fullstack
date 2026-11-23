
"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface FilterBarProps {
    onSearch: (filters: { query: string; status?: string; tags?: string[] }) => void;
    placeholder?: string;
    showStatusFilter?: boolean;
}

export default function FilterBar({ onSearch, placeholder = "Search...", showStatusFilter = true }: FilterBarProps) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    // const [tags, setTags] = useState<string[]>([]); // Future: Tag multi-select

    // Debounce query to avoid API spam
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 500);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        onSearch({
            query: debouncedQuery,
            ...(status ? { status } : {})
        });
    }, [debouncedQuery, status]);

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-card placeholder-muted-foreground focus:outline-none focus:placeholder-muted-foreground focus:ring-1 focus:ring-primary/40 focus:border-primary/30 sm:text-sm"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {showStatusFilter && (
                <div className="sm:w-48">
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-primary/40 focus:border-primary/30 sm:text-sm rounded-md"
                    >
                        <option value="">All Statuses</option>
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="CONNECTED">Connected</option>
                        <option value="REPLIED">Replied</option>
                        <option value="INTERESTED">Interested</option>
                        <option value="NOT_INTERESTED">Not Interested</option>
                    </select>
                </div>
            )}

            {/* Future: Add Filtering by Tag here */}
        </div>
    );
}
