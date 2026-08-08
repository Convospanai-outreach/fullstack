"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { importCSV } from "@/lib/api/leads";
// Basic auto-detection
const autoDetectFieldMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
        const nh = h.toLowerCase().replace(/[\s_]+/g, '');
        if (nh.includes('email') || nh === 'mail') mapping[h] = 'email';
        else if (nh.includes('name') || nh === 'fullname' || nh === 'contactname') mapping[h] = 'fullName';
        else if (nh.includes('linkedin') || nh.includes('profile')) mapping[h] = 'linkedIn';
    });
    return mapping;
};
import Papa from "papaparse";

export default function ImportLeadsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const campaignId = searchParams.get("campaignId") || undefined;
    const [csvText, setCsvText] = useState("");
    const [headers, setHeaders] = useState<string[]>([]);
    const [preview, setPreview] = useState<any[]>([]);
    const [fieldMapping, setFieldMapping] = useState<{ [key: string]: string }>(
        {}
    );
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setCsvText(text);
            parsePreview(text);
        };
        reader.readAsText(file);
    };

    const parsePreview = (text: string) => {
        const parsed = Papa.parse(text, {
            header: true,
            preview: 5,
            skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
            setError("Error parsing CSV: " + parsed.errors[0]?.message || "Unknown error");
            return;
        }

        const csvHeaders = parsed.meta.fields || [];
        setHeaders(csvHeaders);
        setPreview(parsed.data);

        // Auto-detect field mapping
        const detected = autoDetectFieldMapping(csvHeaders);
        setFieldMapping(detected);
        setError("");
    };

    const handleImport = async () => {
        if (!csvText) {
            setError("Please upload a CSV file");
            return;
        }

        setImporting(true);
        setError("");
        setResult(null);

        try {
            const importResult = await importCSV(csvText, fieldMapping, campaignId);
            setResult(importResult);

            if (importResult.created > 0) {
                setTimeout(() => {
                    router.push(campaignId ? `/campaigns/${campaignId}` : "/leads");
                }, 3000);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to import CSV");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen text-slate-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <button
                        onClick={() => router.push("/leads")}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors mb-4 flex items-center gap-1 text-sm font-semibold"
                    >
                        ← Back to leads
                    </button>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Import Leads from CSV</h1>
                    <p className="mt-2 text-slate-400">
                        Upload a CSV file with lead information
                    </p>
                </div>

                {/* File Upload */}
                <div className="bg-[#050d17]/60 border border-white/5 rounded-xl p-6 mb-6 backdrop-blur-md shadow-glow shadow-glow-cyan/5">
                    <h2 className="text-lg font-semibold text-white mb-4">1. Upload CSV File</h2>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-950/40 file:text-indigo-300 hover:file:bg-indigo-900/40 border border-white/5 bg-slate-950/20 p-4 rounded-xl transition-all"
                    />
                </div>

                {/* CSV Preview */}
                {preview.length > 0 && (
                    <div className="bg-[#050d17]/60 border border-white/5 rounded-xl p-6 mb-6 backdrop-blur-md">
                        <h2 className="text-lg font-semibold text-white mb-4">2. Preview (First 5 Rows)</h2>
                        <div className="overflow-x-auto border border-white/5 rounded-lg">
                            <table className="min-w-full divide-y divide-white/5">
                                <thead className="bg-slate-900/40 border-b border-white/5">
                                    <tr>
                                        {headers.map((header) => (
                                            <th
                                                key={header}
                                                className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {preview.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            {headers.map((header) => (
                                                <td
                                                    key={header}
                                                    className="px-4 py-3 text-sm text-slate-300"
                                                >
                                                    {row[header] || "—"}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Field Mapping */}
                {headers.length > 0 && (
                    <div className="bg-[#050d17]/60 border border-white/5 rounded-xl p-6 mb-6 backdrop-blur-md">
                        <h2 className="text-lg font-semibold text-white mb-4">3. Map Fields</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {headers.map((header) => (
                                <div key={header} className="flex items-center gap-2">
                                    <label className="w-1/2 text-sm font-medium text-slate-300">
                                        {header}
                                    </label>
                                    <select
                                        value={fieldMapping[header] || ""}
                                        onChange={(e) =>
                                            setFieldMapping({
                                                ...fieldMapping,
                                                [header]: e.target.value,
                                            })
                                        }
                                        className="w-1/2 px-3 py-2 border border-white/10 bg-slate-950/40 text-slate-200 rounded-md text-sm outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
                                    >
                                        <option value="" className="bg-[#0f172a] text-slate-200">Skip</option>
                                        <option value="fullName" className="bg-[#0f172a] text-slate-200">Full Name</option>
                                        <option value="email" className="bg-[#0f172a] text-slate-200">Email</option>
                                        <option value="linkedIn" className="bg-[#0f172a] text-slate-200">LinkedIn</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Import Button */}
                {csvText && (
                    <div className="bg-[#050d17]/60 border border-white/5 rounded-xl p-6 mb-6 backdrop-blur-md">
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-md disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-all font-semibold shadow-glow shadow-glow-indigo"
                        >
                            {importing ? "Importing..." : "Import Leads"}
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded mb-6 text-sm">
                        {error}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="bg-[#050d17]/60 border border-white/5 rounded-xl p-6 backdrop-blur-md">
                        <h2 className="text-lg font-semibold text-white mb-4">Import Results</h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-4 bg-green-950/20 border border-green-900/30 rounded">
                                <p className="text-3xl font-bold text-green-400">
                                    {result.created}
                                </p>
                                <p className="text-sm text-green-300">Created</p>
                            </div>
                            <div className="text-center p-4 bg-yellow-950/20 border border-yellow-900/30 rounded">
                                <p className="text-3xl font-bold text-yellow-400">
                                    {result.skipped}
                                </p>
                                <p className="text-sm text-yellow-300">Skipped (Duplicates)</p>
                            </div>
                            <div className="text-center p-4 bg-red-950/20 border border-red-900/30 rounded">
                                <p className="text-3xl font-bold text-red-400">
                                    {result.errors.length}
                                </p>
                                <p className="text-sm text-red-300">Errors</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-white mb-2">Errors:</h3>
                                <ul className="list-disc list-inside text-sm text-red-400">
                                    {result.errors.map((err: any, idx: number) => (
                                        <li key={idx}>{err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.created > 0 && (
                            <p className="mt-4 text-sm text-slate-400 animate-pulse">
                                Redirecting to leads page in 3 seconds...
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
