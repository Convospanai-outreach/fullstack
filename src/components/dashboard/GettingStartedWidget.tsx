"use client";

import useSWR from "swr";
import Link from "next/link";
import { clsx } from "clsx";
import { ONBOARDING_STEPS } from "@/modules/onboarding/service/onboardingService";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GettingStartedWidget() {
    const { data: completedSteps } = useSWR<string[]>(process.env['NEXT_PUBLIC_API_URL'] + "/onboarding/status", fetcher);

    if (!completedSteps) return null; // Loading or error
    if (completedSteps.length === ONBOARDING_STEPS.length) return null; // All done!

    const progress = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);

    return (
        <div className="mb-8 glass border border-white/10 rounded-xl p-6 bg-gradient-to-r from-indigo-900/20 to-purple-900/20">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Getting Started</h3>
                    <p className="text-sm text-gray-400">Complete these steps to set up your account.</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-indigo-400">{progress}%</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 h-2 rounded-full mb-6 overflow-hidden">
                <div className="bg-indigo-500 h-2 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ONBOARDING_STEPS.map((step) => {
                    const isDone = completedSteps.includes(step.id);
                    return (
                        <Link
                            key={step.id}
                            href={isDone ? "#" : step.href}
                            className={clsx(
                                "p-4 rounded-lg border transition-all flex items-center space-x-3",
                                isDone
                                    ? "bg-green-500/10 border-green-500/20 cursor-default opacity-70"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/50"
                            )}
                        >
                            <div className={clsx(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                isDone ? "bg-green-500 text-white" : "bg-gray-700 text-gray-300"
                            )}>
                                {isDone ? "✓" : ""}
                            </div>
                            <span className={clsx("text-sm font-medium", isDone ? "text-green-200" : "text-gray-200")}>
                                {step.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
