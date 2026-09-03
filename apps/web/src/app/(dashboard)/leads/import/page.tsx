"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { importCSV } from "@/lib/api/leads";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
    const [hasConsent, setHasConsent] = useState(false);

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
            const importResult = await importCSV(csvText, fieldMapping, campaignId, hasConsent);
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
        <div className="min-h-screen text-foreground">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <button
                    onClick={() => router.push("/leads")}
                    className="text-primary hover:text-primary/80 transition-colors mb-4 flex items-center gap-1 text-sm font-semibold"
                >
                    ← Back to leads
                </button>
                <SectionHeader title="Import Leads from CSV" subtitle="Upload a CSV file with lead information" />

                {/* File Upload */}
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">1. Upload CSV File</h2>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-input bg-background p-4 rounded-md transition-all"
                    />
                </div>

                {/* CSV Preview */}
                {preview.length > 0 && (
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">2. Preview (First 5 Rows)</h2>
                        <div className="overflow-x-auto border border-border rounded-lg">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted border-b border-border">
                                    <tr>
                                        {headers.map((header) => (
                                            <th
                                                key={header}
                                                className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {preview.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-accent transition-colors">
                                            {headers.map((header) => (
                                                <td
                                                    key={header}
                                                    className="px-4 py-3 text-sm text-foreground"
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
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">3. Map Fields</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {headers.map((header) => (
                                <div key={header} className="flex items-center gap-2">
                                    <label className="w-1/2 text-sm font-medium text-foreground">
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
                                        className="w-1/2 px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm outline-none focus:border-primary/50 transition-colors cursor-pointer"
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
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mb-6">
                        <label className="flex items-start gap-3 mb-4 text-sm text-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hasConsent}
                                onChange={(e) => setHasConsent(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary cursor-pointer"
                            />
                            <span>
                                I confirm these leads have given consent to be contacted, or contacting them is otherwise lawful under applicable data protection law (e.g. DPDP, GDPR).
                            </span>
                        </label>
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-md disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all font-semibold"
                        >
                            {importing ? "Importing..." : "Import Leads"}
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded mb-6 text-sm">
                        {error}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Import Results</h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-4 bg-success/10 border border-success/30 rounded">
                                <p className="text-3xl font-bold text-success">
                                    {result.created}
                                </p>
                                <p className="text-sm text-success">Created</p>
                            </div>
                            <div className="text-center p-4 bg-warning/10 border border-warning/30 rounded">
                                <p className="text-3xl font-bold text-warning">
                                    {result.skipped}
                                </p>
                                <p className="text-sm text-warning">Skipped (Duplicates)</p>
                            </div>
                            <div className="text-center p-4 bg-destructive/10 border border-destructive/30 rounded">
                                <p className="text-3xl font-bold text-destructive">
                                    {result.errors.length}
                                </p>
                                <p className="text-sm text-destructive">Errors</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-foreground mb-2">Errors:</h3>
                                <ul className="list-disc list-inside text-sm text-destructive">
                                    {result.errors.map((err: any, idx: number) => (
                                        <li key={idx}>{err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.created > 0 && (
                            <p className="mt-4 text-sm text-muted-foreground animate-pulse">
                                Redirecting to leads page in 3 seconds...
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
