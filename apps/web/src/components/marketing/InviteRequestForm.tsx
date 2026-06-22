"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle } from "lucide-react";

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
        <form onSubmit={submitInviteRequest} className="mx-auto grid max-w-3xl gap-4 text-left sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-[28px] border border-amber-200/30 bg-gradient-to-br from-amber-200/16 via-slate-950/80 to-cyan-300/12 p-5 shadow-[0_20px_80px_rgba(251,191,36,0.18)] backdrop-blur-xl">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Pilot outcome preview</p>
                        <h3 className="mt-2 text-xl font-black text-white">Signals become governed meetings.</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">A quick metric story before the form: captured intent, approved outreach, and pipeline your team can control.</p>
                    </div>
                    <div className="grid min-w-[180px] grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                        <div>
                            <p className="text-2xl font-black text-cyan-200">47</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Qualified leads</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-amber-200">12</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Meetings</p>
                        </div>
                    </div>
                </div>
            </div>
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
                placeholder="What kind of outreach are you trying to govern?"
            />
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3">
                    {/* Native button — shadcn Button base styles wash out the gradient */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: "linear-gradient(135deg, #facc15 0%, #22d3ee 48%, #38bdf8 100%)",
                            boxShadow: "0 18px 45px rgba(34,211,238,0.35), 0 0 0 1px rgba(255,255,255,0.55) inset",
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-100/70 px-10 py-4 text-sm font-black text-slate-950 shadow-xl transition-all duration-200 hover:scale-105 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-80"
                    >
                        {loading ? "Requesting…" : "Request Early Access →"}
                    </button>
                    <p className="text-sm text-slate-500">We review every request manually. You&apos;ll hear back within 2 business days.</p>
                </div>
                {message && <p className="flex items-center gap-2 text-sm text-emerald-200"><CheckCircle className="h-4 w-4" />{message}</p>}
                {error && <p className="text-sm text-red-200">{error}</p>}
            </div>
        </form>
    );
}
