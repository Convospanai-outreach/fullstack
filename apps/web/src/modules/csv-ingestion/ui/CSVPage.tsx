"use client";

import React, { useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function CSVPage() {
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleUpload = async (file: File) => {
        setUploading(true);
        setResult(null);
        try {
            const text = await file.text();
            const res = await fetch(getBrowserApiBase() + "/leads/import", {
                method: "POST",
                body: text,
            });
            const data = await res.json();
            setResult(data);
        } catch (error) {
            console.error(error);
            setResult({ success: false, message: "Upload failed" });
        } finally {
            setUploading(false);
        }
    };

    const onDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    return (
        <div className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <SectionHeader title="Import Leads" subtitle="Bulk upload contacts via CSV" />

                <div className="mt-8 glass p-8 rounded-xl border border-white/10">
                    <div
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragActive ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40"
                            }`}
                        onDragEnter={onDrag}
                        onDragLeave={onDrag}
                        onDragOver={onDrag}
                        onDrop={onDrop}
                    >
                        <div className="mb-4">
                            <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <p className="text-lg text-white font-medium mb-2">
                            Drag and drop your CSV file here
                        </p>
                        <p className="text-sm text-gray-400 mb-6">
                            or click to browse from your computer
                        </p>

                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept=".csv"
                            onChange={handleChange}
                            disabled={uploading}
                        />
                        <label
                            htmlFor="file-upload"
                            className={`inline-block px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors ${uploading ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                        >
                            {uploading ? "Uploading..." : "Select File"}
                        </label>
                    </div>

                    {/* Results */}
                    {result && (
                        <div className={`mt-8 p-6 rounded-lg border ${result.success ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                            }`}>
                            <h3 className={`text-lg font-bold mb-2 ${result.success ? "text-green-400" : "text-red-400"
                                }`}>
                                {result.success ? "Import Successful" : "Import Failed"}
                            </h3>

                            {result.success && (
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div className="bg-black/20 p-3 rounded-lg">
                                        <div className="text-sm text-gray-400">Total Rows</div>
                                        <div className="text-xl font-bold text-white">{result.totalParsed}</div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-lg">
                                        <div className="text-sm text-gray-400">Inserted</div>
                                        <div className="text-xl font-bold text-green-400">{result.inserted}</div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-lg">
                                        <div className="text-sm text-gray-400">Skipped (Dupes)</div>
                                        <div className="text-xl font-bold text-yellow-400">{result.skipped}</div>
                                    </div>
                                </div>
                            )}

                            {result.errors && result.errors.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-red-400 mb-2">Errors:</h4>
                                    <ul className="list-disc list-inside text-sm text-gray-400 max-h-32 overflow-y-auto">
                                        {result.errors.map((err: string, i: number) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-8 text-sm text-gray-500">
                        <p className="mb-2 font-medium">Supported Columns:</p>
                        <code className="bg-white/5 px-2 py-1 rounded">email</code>, <code className="bg-white/5 px-2 py-1 rounded">name</code>, <code className="bg-white/5 px-2 py-1 rounded">company</code>, <code className="bg-white/5 px-2 py-1 rounded">jobTitle</code>, <code className="bg-white/5 px-2 py-1 rounded">location</code>, <code className="bg-white/5 px-2 py-1 rounded">linkedin</code>
                    </div>
                </div>
            </div>
        </div>
    );
}
