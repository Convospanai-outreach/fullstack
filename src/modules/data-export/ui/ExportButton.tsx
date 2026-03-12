"use client";

import { useState } from "react";

export default function ExportButton({ type }: { type: "leads" | "campaigns" }) {
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleExport = async (format: "csv" | "json") => {
        setLoading(true);
        setShowMenu(false);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/data-export/download?type=${type}&format=${format}`);
            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${type}-export.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert("Failed to download export");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative inline-block text-left">
            <button
                onClick={() => setShowMenu(!showMenu)}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 border border-white/10 rounded-lg shadow-sm text-sm font-medium text-white bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-colors"
            >
                {loading ? "Exporting..." : "Export"}
                <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {showMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-32 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="py-1">
                        <button
                            onClick={() => handleExport("csv")}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                            Export CSV
                        </button>
                        <button
                            onClick={() => handleExport("json")}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                            Export JSON
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
