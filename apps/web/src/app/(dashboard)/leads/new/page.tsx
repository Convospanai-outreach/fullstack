"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function NewLeadPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        company: "",
        jobTitle: "",
        linkedIn: "",
        status: "NEW",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email.trim()) {
            toast.error("Email address is required.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(getBrowserApiUrl("/leads"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to create lead.");
            }

            toast.success("Lead created successfully!");
            router.push("/leads");
        } catch (err: any) {
            toast.error(err?.message || "Failed to create lead.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Link
                    href="/leads"
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <SectionHeader title="Add New Lead" subtitle="Manually enter a contact into your leads." />
            </div>

            <form onSubmit={handleSubmit} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Jane Doe"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Email Address <span className="text-primary">*</span>
                    </label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jane@company.com"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Company
                        </label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Acme Corp"
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Job Title
                        </label>
                        <input
                            type="text"
                            value={formData.jobTitle}
                            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                            placeholder="VP of Growth"
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                        LinkedIn Profile URL
                    </label>
                    <input
                        type="url"
                        value={formData.linkedIn}
                        onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                        placeholder="https://linkedin.com/in/janedoe"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
                    <Link
                        href="/leads"
                        className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Lead
                    </button>
                </div>
            </form>
        </div>
    );
}
