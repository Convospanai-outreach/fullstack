"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import CampaignIntakeForm from "./CampaignIntakeForm";
import TemplateGallery from "./TemplateGallery";
import { landingStartChoices } from "./landingTemplateGallery";

type ChoiceId = (typeof landingStartChoices)[number]["id"];

// "New landing page": start from a template (no AI) or write it with AI (the existing intake form).
export default function LandingStartChooser() {
    const [choice, setChoice] = useState<ChoiceId | null>(null);

    if (choice === "ai") {
        return (
            <div className="space-y-4">
                <BackButton onClick={() => setChoice(null)} />
                <CampaignIntakeForm />
            </div>
        );
    }

    if (choice === "template") {
        return (
            <GlassCard className="mx-auto max-w-6xl space-y-6 p-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Landing Agent</p>
                        <h1 className="mt-2 text-3xl font-bold text-white">Start from a template</h1>
                        <p className="mt-2 text-sm text-slate-300">Pick the layout closest to your goal. You can change everything in the editor.</p>
                    </div>
                    <BackButton onClick={() => setChoice(null)} />
                </div>
                <TemplateGallery />
            </GlassCard>
        );
    }

    return (
        <GlassCard className="mx-auto max-w-4xl space-y-6 p-8">
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Landing Agent</p>
                <h1 className="mt-2 text-3xl font-bold text-white">New landing page</h1>
                <p className="mt-2 text-sm text-slate-300">Choose how you want to start.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {landingStartChoices.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setChoice(option.id)}
                        className="rounded-xl border border-white/10 bg-slate-900/60 p-5 text-left hover:border-cyan-400/60"
                    >
                        <h2 className="text-lg font-semibold text-white">{option.title}</h2>
                        <p className="mt-2 text-sm text-slate-300">{option.description}</p>
                    </button>
                ))}
            </div>
        </GlassCard>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="text-sm text-cyan-300 underline">
            Back to the choices
        </button>
    );
}
