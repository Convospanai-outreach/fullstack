"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const benefits = [
    "AI that sounds exactly like you",
    "Full team approval flows built in",
    "Real-time intent signals per lead",
];

export default function LoginPage() {
    const router = useRouter();
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorMessage(null);
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: credentials.email,
                password: credentials.password,
            });

            if (result?.error) {
                setErrorMessage("Invalid email or password. Please try again.");
            } else {
                toast.success("Welcome back!");
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setErrorMessage("Something went wrong while signing in.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden p-4">
            {/* Background */}
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
                <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center py-10">
                <div className="grid w-full gap-12 lg:grid-cols-[1.1fr,0.9fr]">

                    {/* ── LEFT: Value Prop ── */}
                    <div className="hidden space-y-8 self-center lg:block">
                        {/* Brand */}
                        <div>
                            <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white shadow-lg shadow-violet-500/25">
                                    CS
                                </div>
                                ConvoSpan
                            </Link>
                        </div>

                        <div>
                            <h1 className="text-4xl font-black leading-tight text-white">
                                Welcome back.{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                                    Your pipeline is waiting.
                                </span>
                            </h1>
                            <p className="mt-4 text-lg text-slate-400">
                                Resume your campaigns, check what's in review, and see which leads just signaled buying intent.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {benefits.map((b) => (
                                <div key={b} className="flex items-center gap-3 text-slate-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                                    <span>{b}</span>
                                </div>
                            ))}
                        </div>

                        {/* Mini testimonial */}
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                            <div className="flex gap-1 mb-3">
                                {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                            </div>
                            <p className="text-sm leading-7 text-slate-300 italic">
                                &ldquo;We went from 8% to 27% reply rate in our first month. ConvoSpan sounds just like our team.&rdquo;
                            </p>
                            <p className="mt-3 text-xs text-slate-500">— Arjun S., Sales Director @ Velora</p>
                        </div>
                    </div>

                    {/* ── RIGHT: Form ── */}
                    <div className="animate-[fadeSlideUp_0.5s_ease-out]">
                        <GlassCard>
                            <div className="mb-2 text-center lg:text-left">
                                {/* Mobile brand */}
                                <div className="mb-6 flex justify-center lg:hidden">
                                    <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">CS</div>
                                        ConvoSpan
                                    </Link>
                                </div>
                                <h2 className="text-2xl font-bold text-white">Sign in to your workspace</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Access is invite-only. Please{" "}
                                    <Link href="/signup" className="font-medium text-violet-400 hover:text-violet-300">
                                        join the waiting list
                                    </Link>{" "}
                                    if you do not have credentials.
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="mt-7 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Work email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        id="login-email"
                                        required
                                        autoComplete="email"
                                        value={credentials.email}
                                        onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="block text-sm font-medium text-slate-300">Password</label>
                                        <Link href="/forgot-password" className="text-sm text-violet-400 transition-colors hover:text-violet-300">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        id="login-password"
                                        required
                                        autoComplete="current-password"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <Button
                                    disabled={loading}
                                    type="submit"
                                    id="login-submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-base font-semibold shadow-lg shadow-violet-500/20 transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/30 disabled:opacity-60"
                                >
                                    {loading ? "Signing in..." : "Sign in"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </Button>

                                {errorMessage && (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                                        {errorMessage}
                                    </div>
                                )}

                                <div className="grid gap-3">
                                    <button
                                        type="button"
                                        id="login-sso"
                                        onClick={() => router.push("/login/sso")}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                    >
                                        <Lock className="h-4 w-4 text-orange-400" />
                                        Enterprise SSO
                                    </button>
                                </div>
                            </form>

                            {/* Trust line */}
                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                <span>End-to-end encrypted · SOC 2 compliant · GDPR ready</span>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </main>
    );
}
