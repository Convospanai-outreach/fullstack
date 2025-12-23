"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
            setError("Error parsing CSV: " + parsed.errors[0].message);
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
            const importResult = await importCSV(csvText, fieldMapping);
            setResult(importResult);

            if (importResult.created > 0) {
                setTimeout(() => {
                    router.push("/leads");
                }, 3000);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to import CSV");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <button
                        onClick={() => router.push("/leads")}
                        className="text-blue-600 hover:text-blue-700 mb-4"
                    >
                        ← Back to leads
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Import Leads from CSV</h1>
                    <p className="mt-2 text-gray-600">
                        Upload a CSV file with lead information
                    </p>
                </div>

                {/* File Upload */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">1. Upload CSV File</h2>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                </div>

                {/* CSV Preview */}
                {preview.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4">2. Preview (First 5 Rows)</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {headers.map((header) => (
                                            <th
                                                key={header}
                                                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {preview.map((row, idx) => (
                                        <tr key={idx}>
                                            {headers.map((header) => (
                                                <td
                                                    key={header}
                                                    className="px-4 py-2 text-sm text-gray-600"
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
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4">3. Map Fields</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {headers.map((header) => (
                                <div key={header} className="flex items-center gap-2">
                                    <label className="w-1/2 text-sm font-medium text-gray-700">
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
                                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Skip</option>
                                        <option value="fullName">Full Name</option>
                                        <option value="email">Email</option>
                                        <option value="linkedIn">LinkedIn</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Import Button */}
                {csvText && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                            {importing ? "Importing..." : "Import Leads"}
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold mb-4">Import Results</h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-4 bg-green-50 rounded">
                                <p className="text-3xl font-bold text-green-600">
                                    {result.created}
                                </p>
                                <p className="text-sm text-gray-600">Created</p>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded">
                                <p className="text-3xl font-bold text-yellow-600">
                                    {result.skipped}
                                </p>
                                <p className="text-sm text-gray-600">Skipped (Duplicates)</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded">
                                <p className="text-3xl font-bold text-red-600">
                                    {result.errors.length}
                                </p>
                                <p className="text-sm text-gray-600">Errors</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div>
                                <h3 className="font-semibold mb-2">Errors:</h3>
                                <ul className="list-disc list-inside text-sm text-red-600">
                                    {result.errors.map((err: any, idx: number) => (
                                        <li key={idx}>{err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.created > 0 && (
                            <p className="mt-4 text-sm text-gray-600">
                                Redirecting to leads page in 3 seconds...
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
