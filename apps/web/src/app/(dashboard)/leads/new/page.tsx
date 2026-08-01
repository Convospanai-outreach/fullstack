"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";

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
            const res = await fetch(`${API_BASE}/leads`, {
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
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Link
                    href="/leads"
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-cyan-400" />
                        Add New Lead
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Manually enter a contact into the Lead Registry.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-[#030303] border border-white/10 p-6 rounded-lg space-y-4">
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Jane Doe"
                        className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Email Address <span className="text-cyan-400">*</span>
                    </label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jane@company.com"
                        className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Company
                        </label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Acme Corp"
                            className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Job Title
                        </label>
                        <input
                            type="text"
                            value={formData.jobTitle}
                            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                            placeholder="VP of Growth"
                            className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                        LinkedIn Profile URL
                    </label>
                    <input
                        type="url"
                        value={formData.linkedIn}
                        onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                        placeholder="https://linkedin.com/in/janedoe"
                        className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                    <Link
                        href="/leads"
                        className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Lead
                    </button>
                </div>
            </form>
        </div>
    );
}
