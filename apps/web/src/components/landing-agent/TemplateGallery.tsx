"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import { GlassCard } from "@/components/ui/GlassCard";
import TemplatePreview from "./TemplatePreview";
import {
    editorPathForCampaign,
    galleryTemplates,
    isCreateFromTemplateResponse,
    templateRequestBody,
    validateTemplateName,
} from "./landingTemplateGallery";

const TEMPLATE_CARDS = galleryTemplates();

// Pick a template, name the page, and open it in the editor. No AI call happens on this path.
export default function TemplateGallery() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function createFromTemplate(templateId: string) {
        const checked = validateTemplateName(name);
        if (!checked.ok) {
            setError(checked.error);
            return;
        }
        setBusyId(templateId);
        setError(null);
        try {
            const created = await landingAgentApi.createCampaignFromTemplate(templateRequestBody(templateId, checked.name));
            if (!isCreateFromTemplateResponse(created)) {
                throw new Error("Unexpected response from the server. Try again.");
            }
            router.push(editorPathForCampaign(created.campaignId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the page.");
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label htmlFor="template-page-name" className="text-sm text-slate-200">Page name</label>
                <input
                    id="template-page-name"
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="For example: Spring workshop guide"
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                />
                {error && (
                    <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        {error}
                    </p>
                )}
            </div>

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATE_CARDS.map((template) => (
                    <li key={template.id}>
                        <GlassCard className="flex h-full flex-col gap-4 p-5">
                            <TemplatePreview accent={template.accent} layout={template.preview} />
                            <div className="flex-1 space-y-1">
                                <h2 className="text-lg font-semibold text-white">{template.name}</h2>
                                <p className="text-xs text-cyan-300">For: {template.audience}</p>
                                <p className="text-sm text-slate-300">{template.description}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => createFromTemplate(template.id)}
                                disabled={busyId !== null}
                                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                            >
                                {busyId === template.id ? "Creating..." : "Use this template"}
                            </button>
                        </GlassCard>
                    </li>
                ))}
            </ul>
        </div>
    );
}
