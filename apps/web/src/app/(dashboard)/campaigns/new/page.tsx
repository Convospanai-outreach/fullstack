"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const RECOVERABLE_STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED"] as const;

function buildLeadsQuery(stage: string, domain: string) {
    const params = new URLSearchParams({ pipelineState: stage, unassignedOnly: "true", limit: "500" });
    if (domain) params.set("domain", domain);
    return `/api/leads?${params.toString()}`;
}

export default function NewCampaignPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [targetStageEnabled, setTargetStageEnabled] = useState(false);
    const [stage, setStage] = useState<string>("WARM");
    const [domain, setDomain] = useState("");
    const [matchingCount, setMatchingCount] = useState<number | null>(null);

    useEffect(() => {
        const prefillStage = searchParams.get("stage");
        const prefillDomain = searchParams.get("domain");
        if (prefillStage && (RECOVERABLE_STAGES as readonly string[]).includes(prefillStage)) {
            setTargetStageEnabled(true);
            setStage(prefillStage);
        }
        if (prefillDomain) {
            setDomain(prefillDomain);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!targetStageEnabled) {
            setMatchingCount(null);
            return;
        }
        let cancelled = false;
        fetch(buildLeadsQuery(stage, domain))
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled) setMatchingCount(typeof data.total === "number" ? data.total : (data.leads?.length ?? 0));
            })
            .catch(() => {
                if (!cancelled) setMatchingCount(null);
            });
        return () => {
            cancelled = true;
        };
    }, [targetStageEnabled, stage, domain]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Campaign name is required.");
            return;
        }

        setSubmitting(true);
        try {
            const body: Record<string, unknown> = {
                name: name.trim(),
                description: description.trim() || undefined,
            };

            if (targetStageEnabled) {
                const res = await fetch(buildLeadsQuery(stage, domain));
                const data = await res.json();
                const ids: string[] = (data.leads || []).map((lead: { id: string }) => lead.id);
                body["leads"] = ids;
                body["sourcePipelineStage"] = stage;
                body["targetCount"] = ids.length;
            }

            const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to create campaign");
            }

            toast.success(`Campaign "${data.name || name}" created successfully!`);
            router.push("/campaigns");
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 space-y-6">
            <Link
                href="/campaigns"
                className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Campaigns
            </Link>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Create Outreach Campaign</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Create a new campaign workflow to organize leads, copy, and human approvals.
                        </p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                Campaign Name <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Q3 B2B SaaS Founders - Email Sequence"
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                Description / Objective <span className="text-muted-foreground">(Optional)</span>
                            </label>
                            <textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Target audience, value proposition summary, or key campaign goals..."
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                            />
                        </div>

                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={targetStageEnabled}
                                    onChange={(e) => setTargetStageEnabled(e.target.checked)}
                                    className="h-4 w-4"
                                />
                                Target leads stuck at a stage
                            </label>

                            {targetStageEnabled && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                            Funnel stage
                                        </label>
                                        <select
                                            value={stage}
                                            onChange={(e) => setStage(e.target.value)}
                                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                                        >
                                            {RECOVERABLE_STAGES.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                            Account domain <span className="text-muted-foreground">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value)}
                                            placeholder="e.g. acme.example"
                                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {matchingCount === null ? "Checking matching leads..." : `${matchingCount} leads match`}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                            <Link href="/campaigns">
                                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">
                                    Cancel
                                </Button>
                            </Link>
                            <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 text-white font-semibold">
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Campaign
                            </Button>
                        </div>
                    </form>
            </div>
        </div>
    );
}
