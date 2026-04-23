"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { landingAgentApi, uploadPdfToKnowledge } from "@/modules/landing-agent/service/landingAgentApi";

const FRAMEWORKS = [
    { value: "", label: "Auto-recommend" },
    { value: "PAS", label: "PAS" },
    { value: "AIDA", label: "AIDA" },
    { value: "MYTH_CORRECTION", label: "Myth Correction" },
    { value: "BEFORE_AFTER_BRIDGE", label: "Before-After-Bridge" },
    { value: "STORY_OFFER_PS", label: "Story-Offer-PS" },
];

export default function CampaignIntakeForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");
    const [framework, setFramework] = useState("");
    const [assetText, setAssetText] = useState("");
    const [assetFile, setAssetFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const campaign = await landingAgentApi.createCampaign({
                name,
                prompt,
                ...(framework ? { framework } : {}),
            });

            if (assetText.trim()) {
                await landingAgentApi.addAsset(campaign.id, {
                    text: assetText.trim(),
                    sourceName: "manual-text",
                });
            }

            if (assetFile) {
                const uploaded = await uploadPdfToKnowledge(assetFile);
                await landingAgentApi.addAsset(campaign.id, {
                    pdfKnowledgeItemId: uploaded.documentId,
                    sourceName: assetFile.name,
                });
            }

            router.push(`/landing-agent/${campaign.id}/brief`);
        } catch (err: any) {
            setError(err?.message || "Failed to create landing campaign");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <GlassCard className="mx-auto max-w-4xl p-8 space-y-6">
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Landing Agent</p>
                <h1 className="mt-2 text-3xl font-bold text-white">Create Landing Campaign</h1>
                <p className="mt-2 text-sm text-slate-300">
                    Describe your offer, add optional context assets, and generate wireframe directions.
                </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                    <label htmlFor="landing-name" className="text-sm text-slate-200">Campaign name</label>
                    <input
                        id="landing-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                        placeholder="Q3 Demand Capture - Product Launch"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="landing-prompt" className="text-sm text-slate-200">Prompt</label>
                    <textarea
                        id="landing-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-32 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                        placeholder="We help B2B teams automate outbound safely with approvals and auditability."
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="landing-framework" className="text-sm text-slate-200">Framework</label>
                    <select
                        id="landing-framework"
                        value={framework}
                        onChange={(e) => setFramework(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                    >
                        {FRAMEWORKS.map((option) => (
                            <option key={option.value || "auto"} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="landing-asset-text" className="text-sm text-slate-200">Optional context text</label>
                    <textarea
                        id="landing-asset-text"
                        value={assetText}
                        onChange={(e) => setAssetText(e.target.value)}
                        className="min-h-24 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                        placeholder="Paste brochure copy, product notes, or positioning references."
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="landing-asset-file" className="text-sm text-slate-200">Optional PDF asset</label>
                    <input
                        id="landing-asset-file"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                    />
                </div>

                {error ? <p className="text-sm text-rose-300">{error}</p> : null}

                <Button type="submit" disabled={submitting} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                    {submitting ? "Creating..." : "Generate Brief"}
                </Button>
            </form>
        </GlassCard>
    );
}
