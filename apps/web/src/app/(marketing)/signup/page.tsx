"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
    if (!password) return { level: 0, label: "", color: "bg-slate-700" };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: "Weak", color: "bg-red-500" };
    if (score <= 2) return { level: 2, label: "Fair", color: "bg-orange-500" };
    if (score <= 3) return { level: 3, label: "Good", color: "bg-yellow-500" };
    if (score <= 4) return { level: 4, label: "Strong", color: "bg-emerald-500" };
    return { level: 5, label: "Excellent", color: "bg-emerald-400" };
}

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
    const router = useRouter();
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [inviteToken, setInviteToken] = useState("");
    const [inviteStatus, setInviteStatus] = useState<"checking" | "valid" | "invalid">("checking");
    const [inviteMeta, setInviteMeta] = useState<{ teamName?: string; role?: string } | null>(null);

    const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get("token") || "";
        setInviteToken(token);

        if (!token) {
            setInviteStatus("invalid");
            setErrorMessage("Signup is invite-only. Ask an administrator for an invitation link.");
            return;
        }

        let cancelled = false;
        fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Invalid invitation link.");
                return data;
            })
            .then((data) => {
                if (cancelled) return;
                setInviteStatus("valid");
                setInviteMeta({ teamName: data.invitation?.teamName, role: data.invitation?.role });
                setFormData((current) => ({ ...current, email: data.invitation?.email || current.email }));
            })
            .catch((error) => {
                if (cancelled) return;
                setInviteStatus("invalid");
                setErrorMessage(error instanceof Error ? error.message : "Invalid invitation link.");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSignup = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorMessage(null);
        setLoading(true);

        try {
            if (inviteStatus !== "valid" || !inviteToken) {
                throw new Error("A valid invitation is required to create an account.");
            }

            const response = await fetch("/api/invitations/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: inviteToken, name: formData.name, password: formData.password }),
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
                throw new Error((data["error"] as string) || "Unable to create workspace right now.");
            }

            toast.success("Invite accepted. Please sign in.");
            router.push("/login");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unable to create workspace.";
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
                                CraftMyFunnel
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
                                    CraftMyFunnel
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

                            <h2 className="text-2xl font-bold text-white">Accept your invitation</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Already have an account?{" "}
                                <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
                                    Sign in
                                </Link>
                            </p>
                            {inviteStatus === "valid" && inviteMeta && (
                                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                    Joining {inviteMeta.teamName || "your team"} as {inviteMeta.role || "SALES_USER"}.
                                </div>
                            )}

                            <form onSubmit={handleSignup} className="mt-6 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Full name</label>
                                    <input
                                        type="text"
                                        id="signup-name"
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
                                        required
                                        value={formData.email}
                                        readOnly
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                                    <input
                                        type="password"
                                        id="signup-password"
                                        required
                                    minLength={8}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Create a strong password"
                                    />
                                    {formData.password && (
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                            i <= passwordStrength.level ? passwordStrength.color : "bg-white/10"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <p
                                                className={`text-xs font-medium ${
                                                    passwordStrength.level <= 1
                                                        ? "text-red-400"
                                                        : passwordStrength.level <= 2
                                                          ? "text-orange-400"
                                                          : passwordStrength.level <= 3
                                                            ? "text-yellow-400"
                                                            : "text-emerald-400"
                                                }`}
                                            >
                                                {passwordStrength.label} password
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    disabled={loading || inviteStatus !== "valid"}
                                    type="submit"
                                    id="signup-submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-base font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/30 disabled:opacity-60"
                                >
                                    {loading ? "Accepting invite..." : "Accept invite and set password"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </Button>

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





