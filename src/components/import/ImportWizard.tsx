
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

export default function ImportWizard({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(1);
    const [_, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [csvContent, setCsvContent] = useState<string>("");
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const router = useRouter();

    const DB_FIELDS = [
        { key: "fullName", label: "Full Name" },
        { key: "email", label: "Email" },
        { key: "company", label: "Company" },
        { key: "role", label: "Role / Job Title" },
        { key: "linkedin", label: "LinkedIn" },
        { key: "location", label: "Location" }
    ];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            setCsvContent(text);

            // Parse headers
            Papa.parse(text, {
                header: true,
                preview: 1, // Only read first line
                complete: async (results) => {
                    const extractedHeaders = results.meta.fields || [];
                    setHeaders(extractedHeaders);

                    // Auto-analyze with Agent
                    await analyzeHeaders(extractedHeaders);

                    setStep(2);
                }
            });
        };
        reader.readAsText(uploadedFile);
    };

    const analyzeHeaders = async (extractedHeaders: string[]) => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/import/suggest-mapping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ headers: extractedHeaders })
            });
            const data = await res.json();
            if (data.success && data.mapping) {
                setMapping(data.mapping);
                toast.success("AI Auto-mapped columns!");
            }
        } catch (error) {
            console.error("Auto-mapping failed", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        try {
            // Send CSV content and mapping to the import API
            const res = await fetch("/api/leads/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    csvContent,
                    mapping
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Import failed");

            toast.success(`Imported ${data.inserted} leads!`);
            onClose();
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full p-6 text-white shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Import Leads</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                {step === 1 && (
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-gray-800/50 transition-colors">
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload" />
                        <label htmlFor="file-upload" className="cursor-pointer block">
                            <div className="text-4xl mb-4">📂</div>
                            <p className="font-medium text-lg">Click to upload CSV</p>
                            <p className="text-sm text-gray-500 mt-2">Supports .csv files</p>
                        </label>
                        {isAnalyzing && <p className="mt-4 text-blue-400 animate-pulse">Analyzing headers...</p>}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300">
                            🤖 AI has mapped columns. Please review below.
                        </div>

                        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                            {headers.map(header => (
                                <div key={header} className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <div className="text-xs text-gray-400 mb-1">CSV Column</div>
                                    <div className="font-medium mb-3 text-white">{header}</div>

                                    <div className="text-xs text-gray-400 mb-1">Maps To</div>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={mapping[header] || ""}
                                        onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                                    >
                                        <option value="">-- Skip --</option>
                                        {DB_FIELDS.map(f => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-700">
                            <button
                                onClick={handleImport}
                                disabled={isImporting}
                                className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {isImporting ? "Importing..." : "Start Import"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
