"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Rocket } from "lucide-react";
import { clsx } from "clsx";

interface OnboardingProgressStep {
    id: string;
    label: string;
    href: string;
    completed: boolean;
}

interface OnboardingProgress {
    percentComplete: number;
    steps: OnboardingProgressStep[];
}

export default function OnboardingChecklist() {
    const [progress, setProgress] = useState<OnboardingProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        fetch(process.env["NEXT_PUBLIC_API_URL"] + "/onboarding/progress")
            .then((response) => response.json())
            .then((json) => {
                if (json.ok) {
                    setProgress(json.progress);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const nextStep = useMemo(() => progress?.steps?.find((step) => !step.completed) ?? null, [progress]);
    const completedCount = progress?.steps?.filter((step) => step.completed).length ?? 0;

    if (loading || !progress || progress.percentComplete === 100) {
        return null;
    }

    if (minimized) {
        return (
            <button
                type="button"
                onClick={() => setMinimized(false)}
                className="fixed bottom-5 right-5 z-[1000] flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-900/30 transition hover:bg-blue-500"
            >
                <Rocket className="h-4 w-4" />
                Resume launch setup ({progress.percentComplete}%)
            </button>
        );
    }

    return (
        <aside className="fixed bottom-5 right-5 z-[1000] w-[340px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur">
            <div className="border-b border-white/10 bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Launch readiness</p>
                        <h4 className="mt-2 text-lg font-semibold">Finish setup and send your first campaign</h4>
                        <p className="mt-1 text-sm text-white/80">
                            {completedCount} of {progress.steps.length} required steps completed.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMinimized(true)}
                        className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
                        aria-label="Minimize onboarding checklist"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress.percentComplete}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/75">
                    <span>{progress.percentComplete}% complete</span>
                    {nextStep && <span>Next up: {nextStep.label}</span>}
                </div>
            </div>

            <div className="space-y-4 p-5">
                {nextStep && (
                    <Link
                        href={nextStep.href}
                        className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-100 transition hover:bg-blue-500/15"
                    >
                        Open next required step
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                )}

                <div className="space-y-2">
                    {progress.steps.map((step, index) => {
                        const content = (
                            <div
                                className={clsx(
                                    "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all",
                                    step.completed
                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                                        : "border-white/10 bg-white/[0.03] text-gray-200 hover:border-white/20 hover:bg-white/[0.05]"
                                )}
                            >
                                <div className="mt-0.5">
                                    {step.completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                    ) : (
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 text-[11px] font-semibold text-gray-400">
                                            {index + 1}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{step.label}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {step.completed ? "Completed" : "Do this next"}
                                    </p>
                                </div>
                                {!step.completed && <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />}
                            </div>
                        );

                        return step.completed ? (
                            <div key={step.id}>{content}</div>
                        ) : (
                            <Link key={step.id} href={step.href}>
                                {content}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
