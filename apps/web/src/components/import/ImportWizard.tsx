"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const DB_FIELDS = [
    { key: "fullName", label: "Full name" },
    { key: "email", label: "Email" },
    { key: "company", label: "Company" },
    { key: "role", label: "Role / job title" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "location", label: "Location" }
];

const stepMeta = [
    {
        id: 1,
        label: "Upload",
        title: "Upload your CSV",
        description: "We will inspect the header row first so you can review the mapping before import starts."
    },
    {
        id: 2,
        label: "Review",
        title: "Confirm the field mapping",
        description: "Check where each CSV column lands and skip anything you do not want to import."
    }
];

export default function ImportWizard({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(1);
    const [fileName, setFileName] = useState("");
    const [headers, setHeaders] = useState<string[]>([]);
    const [csvContent, setCsvContent] = useState("");
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const router = useRouter();

    const mappedCount = useMemo(() => Object.values(mapping).filter(Boolean).length, [mapping]);
    const activeStep = stepMeta[step - 1] ?? stepMeta[0]!;
    const progress = Math.round((step / stepMeta.length) * 100);

    const analyzeHeaders = async (extractedHeaders: string[]) => {
        setIsAnalyzing(true);
        try {
            const response = await fetch(getBrowserApiBase() + "/import/suggest-mapping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ headers: extractedHeaders })
            });
            const data = await response.json();
            if (data.success && data.mapping) {
                setMapping(data.mapping);
                toast.success("Column mapping suggestions are ready.");
            }
        } catch (error) {
            console.error("Auto-mapping failed", error);
            toast.error("We could not suggest mappings automatically. Please review them manually.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = event.target.files?.[0];
        if (!uploadedFile) return;

        setFileName(uploadedFile.name);
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            const text = loadEvent.target?.result as string;
            setCsvContent(text);

            Papa.parse(text, {
                header: true,
                preview: 1,
                complete: async (results) => {
                    const extractedHeaders = results.meta.fields || [];
                    setHeaders(extractedHeaders);
                    await analyzeHeaders(extractedHeaders);
                    setStep(2);
                }
            });
        };
        reader.readAsText(uploadedFile);
    };

    const handleImport = async () => {
        if (mappedCount === 0) {
            toast.error("Map at least one column before importing.");
            return;
        }

        setIsImporting(true);
        try {
            const response = await fetch(getBrowserApiBase() + "/leads/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    csvContent,
                    mapping
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.message || "Import failed");

            toast.success(`Imported ${data.inserted} leads.`);
            onClose();
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-3xl border border-foreground/10 bg-background p-6 text-foreground shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-foreground/10 pb-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Lead import</p>
                        <h2 className="mt-2 text-2xl font-bold">{activeStep.title}</h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{activeStep.description}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full border border-foreground/10 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
                        Close
                    </button>
                </div>

                <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{activeStep.label}</span>
                        <span>{progress}% complete</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                <div className="mt-6 grid gap-2 md:grid-cols-2">
                    {stepMeta.map((item, index) => (
                        <div key={item.id} className={`rounded-2xl border px-4 py-3 ${step >= item.id ? "border-primary/30 bg-primary/10 text-foreground" : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground"}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em]">Step {index + 1}</p>
                            <p className="mt-2 text-sm font-medium">{item.title}</p>
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <div className="mt-8 space-y-6">
                        <label htmlFor="file-upload" className="block cursor-pointer rounded-3xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] p-12 text-center transition hover:border-primary/40 hover:bg-foreground/[0.05]">
                            <input id="file-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Upload className="h-7 w-7" />
                            </div>
                            <p className="mt-5 text-lg font-semibold text-foreground">Choose a CSV to begin</p>
                            <p className="mt-2 text-sm text-muted-foreground">We only read the header row first so you can review the mapping before import starts.</p>
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-sm text-foreground/80">
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                                    Recommended columns
                                </div>
                                <p className="mt-3">Full name, email, company, role, LinkedIn URL, and location are the most useful starting fields.</p>
                            </div>
                            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-sm text-foreground/80">
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                    <AlertCircle className="h-4 w-4 text-warning" />
                                    Before you upload
                                </div>
                                <p className="mt-3">Keep the first row as headers. Extra columns are fine because you can skip them in the next step.</p>
                            </div>
                        </div>

                        {fileName && <p className="text-sm text-muted-foreground">Selected file: {fileName}</p>}
                        {isAnalyzing && <p className="text-sm text-primary">Analyzing headers and suggesting mappings...</p>}
                    </div>
                )}

                {step === 2 && (
                    <div className="mt-8 space-y-6">
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
                            <div className="flex items-center gap-2 font-medium">
                                <Sparkles className="h-4 w-4" />
                                Suggested mappings are ready
                            </div>
                            <p className="mt-2">Review each CSV column below. {mappedCount} of {headers.length} columns are currently mapped.</p>
                        </div>

                        <div className="grid max-h-[420px] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
                            {headers.map((header) => (
                                <div key={header} className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
                                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">CSV column</div>
                                    <div className="mt-2 font-medium text-foreground">{header}</div>

                                    <div className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">Map to</div>
                                    <select
                                        className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30"
                                        value={mapping[header] || ""}
                                        onChange={(event) => setMapping({ ...mapping, [header]: event.target.value })}
                                    >
                                        <option value="">Skip this column</option>
                                        {DB_FIELDS.map((field) => (
                                            <option key={field.key} value={field.key}>{field.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-foreground/10 pt-5">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">{mappedCount > 0 ? `${mappedCount} mapped columns ready to import.` : "Map at least one column to continue."}</p>
                                <button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={isImporting || mappedCount === 0}
                                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-medium text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isImporting ? "Importing..." : "Import leads"}
                                    {!isImporting && <ArrowRight className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
