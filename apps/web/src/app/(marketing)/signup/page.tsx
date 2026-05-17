"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    Lock,
    ShieldCheck,
    Sparkles,
    Star,
    TrendingUp,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const socialProof = [
    { stat: "ICP", label: "focused pilot motion" },
    { stat: "Signals", label: "to meeting workflow" },
    { stat: "Approval", label: "human-controlled launch" },
];

const guaranteePoints = [
    "Review-ready pilot path",
    "Human approval controls",
    "Managed follow-up support",
    "Data you own, exports included",
];

const activationFlow = [
    {
        icon: Clock3,
        title: "Define the service playbook",
        detail: "Pick the ICP, geography, offer, and proof points for the first lead and meeting workflow.",
    },
    {
        icon: Sparkles,
        title: "Start with guardrails",
        detail: "Approval-first workflows keep outreach, follow-ups, and handoffs under human control.",
    },
    {
        icon: TrendingUp,
        title: "Prepare buyer-signal follow-up",
        detail: "Use intent, replies, and caller context to support better-timed follow-up and routing.",
    },
];

export default function SignupPage() {
    const [formData, setFormData] = useState({ name: "", email: "", companyName: "", phone: "", useCase: "" });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSignup = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const raw = await response.text();
            let data: Record<string, unknown> = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = {};
                }
            }

            if (!response.ok) {
                throw new Error((data["error"] as string) || "Unable to join the waiting list right now.");
            }

            const message = (data["message"] as string) || "Thank you. Your request has been received. Our team will review and contact you.";
            setSuccessMessage(message);
            toast.success("Waitlist request received.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unable to join the waiting list.";
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-950 p-4 text-white">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/4 top-20 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute bottom-8 right-1/4 h-[460px] w-[460px] rounded-full bg-amber-500/8 blur-[115px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center py-10">
                <div className="grid w-full gap-12 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="hidden space-y-8 self-center lg:block">
                        <div>
                            <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-black text-white shadow-lg shadow-cyan-500/25">
                                    CS
                                </div>
                                ConvoSpan
                            </Link>
                        </div>

                        <div>
                            <h1 className="text-4xl font-black leading-tight text-white">
                                Start guided growth operations.
                                <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                                    From buyer signal to review-ready workflow.
                                </span>
                            </h1>
                            <p className="mt-4 text-lg text-slate-400">
                                Build the first service-company playbook, approve the campaign workflow, and move qualified leads toward meetings.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {socialProof.map((s) => (
                                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                                    <p className="text-2xl font-black text-white">{s.stat}</p>
                                    <p className="mt-1 text-xs text-slate-400">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">How Launch Works</p>
                            {activationFlow.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.title} className="flex items-start gap-3">
                                        <div className="rounded-lg bg-cyan-500/15 p-2">
                                            <Icon className="h-4 w-4 text-cyan-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <p className="text-xs text-slate-300">{item.detail}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-3">
                            {guaranteePoints.map((g) => (
                                <div key={g} className="flex items-center gap-3 text-slate-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                                    <span className="text-sm">{g}</span>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <div className="mb-3 flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <p className="text-sm italic leading-7 text-slate-300">
                                We replaced two separate outreach tools, tightened approvals, and improved qualified meeting workflow tracking in the first month.
                            </p>
                            <p className="mt-3 text-xs text-slate-500">- Marcus W., VP Sales @ Growthly</p>
                        </div>
                    </div>

                    <div className="animate-[fadeSlideUp_0.5s_ease-out]">
                        <GlassCard>
                            <div className="mb-6 flex justify-center lg:hidden">
                                <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-black text-white">
                                        CS
                                    </div>
                                    ConvoSpan
                                </Link>
                            </div>

                            <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                                    <Zap className="h-4 w-4 text-cyan-300" />
                                    Guided Growth Pilot
                                </div>
                                <p className="mt-1 text-xs text-cyan-100/70">
                                    Start with one ICP, one offer, approval controls, and a managed follow-up workflow.
                                </p>
                            </div>

                            <h2 className="text-2xl font-bold text-white">Join the waiting list</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Already have an account?{" "}
                                <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
                                    Sign in
                                </Link>
                            </p>

                            <form onSubmit={handleSignup} className="mt-6 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Full name</label>
                                    <input
                                        type="text"
                                        id="signup-name"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Alex Johnson"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Work email</label>
                                    <input
                                        type="email"
                                        id="signup-email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Company name</label>
                                    <input
                                        type="text"
                                        id="signup-company"
                                        name="companyName"
                                        required
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Acme Services"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Phone <span className="text-slate-500">optional</span></label>
                                    <input
                                        type="tel"
                                        id="signup-phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="+1 555 0100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Use case <span className="text-slate-500">optional</span></label>
                                    <textarea
                                        id="signup-use-case"
                                        name="useCase"
                                        value={formData.useCase}
                                        onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                                        className="min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Tell us about your lead, meeting, or drip campaign workflow."
                                    />
                                </div>

                                <Button
                                    disabled={loading}
                                    type="submit"
                                    id="signup-submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-base font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/30 disabled:opacity-60"
                                >
                                    {loading ? "Submitting request..." : "Join waiting list"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </Button>

                                {successMessage && (
                                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
                                        {successMessage}
                                    </div>
                                )}

                                {errorMessage && (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                                        {errorMessage}
                                    </div>
                                )}

                                <p className="text-center text-xs text-slate-500">
                                    By signing up you agree to our {" "}
                                    <Link href="/terms" className="text-slate-400 underline hover:text-slate-300">
                                        Terms
                                    </Link>{" "}
                                    and {" "}
                                    <Link href="/privacy" className="text-slate-400 underline hover:text-slate-300">
                                        Privacy Policy
                                    </Link>
                                    .
                                </p>
                            </form>

                            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> SOC 2 Compliant</span>
                                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-500" /> GDPR Ready</span>
                                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Permission-based outreach</span>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </main>
    );
}





