"use client";

import Link from "next/link";
import useSWR from "swr";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { computeFunnelSteps, type FunnelInput, type StepState } from "@/lib/instagramFunnelSteps";
import type { LandingCampaignSummary } from "@/modules/landing-agent/types";

// Checklist for Instagram -> landing page -> lead. It only reads; each step links to the screen
// that already does the work (Settings, Social / Branding, Landing pages).

const TRIGGERS_URL = getBrowserApiUrl("/content/keyword-triggers");
const PAGES_URL = getBrowserApiUrl("/landing-agent/campaigns");

type TriggerList = {
    triggers: FunnelInput["triggers"];
    accounts: FunnelInput["accounts"];
};

// 404 = the creator funnel isn't on for this team.
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
};

const BADGE: Record<StepState, { label: string; className: string }> = {
    done: { label: "Done", className: "bg-emerald-500/15 text-emerald-600" },
    todo: { label: "To do", className: "bg-amber-500/15 text-amber-600" },
    blocked: { label: "Waiting", className: "bg-muted text-muted-foreground" },
    optional: { label: "Optional", className: "bg-muted text-muted-foreground" },
};

export function InstagramFunnelSetup() {
    const triggers = useSWR<TriggerList | null>(TRIGGERS_URL, fetcher);
    const domains = useSWR<{ domains: FunnelInput["domains"] }>("/api/settings/branding/domains", fetcher);
    const pages = useSWR<{ campaigns: LandingCampaignSummary[] }>(PAGES_URL, fetcher);

    const failed = triggers.error || domains.error || pages.error;
    const loading = triggers.data === undefined || domains.data === undefined || pages.data === undefined;

    if (failed) return <p className="text-sm text-destructive">Couldn&apos;t load your setup. Refresh to try again.</p>;
    if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
    const funnel = triggers.data;
    if (!funnel) return <p className="text-sm text-muted-foreground">Instagram auto-replies aren&apos;t switched on for your workspace yet.</p>;

    const steps = computeFunnelSteps({
        accounts: funnel.accounts,
        triggers: funnel.triggers,
        domains: domains.data?.domains ?? [],
        pages: (pages.data?.campaigns ?? []).flatMap((c) => c.pages),
    });
    const next = steps.find((s) => s.state === "todo");

    return (
        <div className="space-y-3">
            {steps.map((step, i) => (
                <div key={step.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{i + 1}. {step.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[step.state].className}`}>{BADGE[step.state].label}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                    {step.state !== "blocked" ? (
                        <Link href={step.href} className={`text-sm underline ${step === next ? "font-semibold" : ""}`}>{step.action}</Link>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
