"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const initialForm = {
    name: "",
    email: "",
    company: "",
    linkedin_url: "",
    use_case: "",
};

export function InviteRequestForm() {
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function submitInviteRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const response = await fetch("/api/invite-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || "Unable to submit invite request.");
            }

            setMessage("Request received. We will review it and email an invite if it is approved.");
            setForm(initialForm);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to submit invite request.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submitInviteRequest} className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
            <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="Name"
            />
            <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="Work email"
            />
            <input
                required
                value={form.company}
                onChange={(event) => setForm({ ...form, company: event.target.value })}
                className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="Company name"
            />
            <input
                required
                type="url"
                value={form.linkedin_url}
                onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })}
                className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="LinkedIn profile URL"
            />
            <textarea
                required
                value={form.use_case}
                onChange={(event) => setForm({ ...form, use_case: event.target.value })}
                className="min-h-28 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 sm:col-span-2"
                placeholder="Primary use case"
            />
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <Button disabled={loading} className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-8 py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60">
                    {loading ? "Requesting..." : "Request Invite"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
                {message && <p className="flex items-center gap-2 text-sm text-emerald-200"><CheckCircle className="h-4 w-4" />{message}</p>}
                {error && <p className="text-sm text-red-200">{error}</p>}
            </div>
        </form>
    );
}
