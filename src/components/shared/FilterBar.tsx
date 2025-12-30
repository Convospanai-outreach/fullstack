
"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface FilterBarProps {
    onSearch: (filters: { query: string; status: string | undefined; tags?: string[] }) => void;
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
            status: status || undefined
        });
    }, [debouncedQuery, status]);

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
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
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
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
