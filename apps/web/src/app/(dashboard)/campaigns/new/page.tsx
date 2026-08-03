"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewCampaignPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Campaign name is required.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                }),
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
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Campaigns
            </Link>

            <Card className="border-white/10 bg-slate-950/80">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-blue/10 rounded-lg text-accent-blue">
                            <Megaphone className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold text-white">Create Outreach Campaign</CardTitle>
                            <p className="text-xs text-text-secondary mt-1">
                                Create a new campaign workflow to organize leads, copy, and human approvals.
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                Campaign Name <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Q3 B2B SaaS Founders - Email Sequence"
                                className="w-full rounded-lg border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                Description / Objective <span className="text-slate-500">(Optional)</span>
                            </label>
                            <textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Target audience, value proposition summary, or key campaign goals..."
                                className="w-full rounded-lg border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                            <Link href="/campaigns">
                                <Button type="button" variant="ghost" className="text-slate-400 hover:text-white">
                                    Cancel
                                </Button>
                            </Link>
                            <Button type="submit" disabled={submitting} className="bg-accent-blue hover:bg-accent-blue/90 text-white font-semibold">
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Campaign
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
