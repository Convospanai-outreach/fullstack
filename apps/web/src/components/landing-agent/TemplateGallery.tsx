"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import { GlassCard } from "@/components/ui/GlassCard";
import TemplatePreview from "./TemplatePreview";
import { validatePagePath } from "./landingPageAddress";
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
    const [path, setPath] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function createFromTemplate(templateId: string) {
        const checked = validateTemplateName(name);
        if (!checked.ok) {
            setError(checked.error);
            return;
        }
        let address: string | undefined;
        if (path.trim()) {
            const checkedPath = validatePagePath(path);
            if (!checkedPath.ok) {
                setError(checkedPath.error);
                return;
            }
            address = checkedPath.path;
        }
        setBusyId(templateId);
        setError(null);
        try {
            const created = await landingAgentApi.createCampaignFromTemplate(templateRequestBody(templateId, checked.name, address));
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
                <label htmlFor="template-page-name" className="text-sm text-foreground">Page name</label>
                <input
                    id="template-page-name"
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="For example: Spring workshop guide"
                    className="w-full rounded-lg border border-foreground/10 bg-background/60 px-3 py-2 text-foreground"
                />
                {error && (
                    <p role="alert" className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-sm text-chart-4">
                        {error}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <label htmlFor="template-page-path" className="text-sm text-foreground">Web address (optional)</label>
                <input
                    id="template-page-path"
                    value={path}
                    maxLength={63}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="spring-guide"
                    className="w-full rounded-lg border border-foreground/10 bg-background/60 px-3 py-2 text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                    The page will be at yourdomain/web-address. Leave it empty to make one from the name. You can change it until the page is published.
                </p>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATE_CARDS.map((template) => (
                    <li key={template.id}>
                        <GlassCard className="flex h-full flex-col gap-4 p-5">
                            <TemplatePreview accent={template.accent} layout={template.preview} />
                            <div className="flex-1 space-y-1">
                                <h2 className="text-lg font-semibold text-foreground">{template.name}</h2>
                                <p className="text-xs text-primary">For: {template.audience}</p>
                                <p className="text-sm text-foreground/80">{template.description}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => createFromTemplate(template.id)}
                                disabled={busyId !== null}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
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
