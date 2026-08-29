"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
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
