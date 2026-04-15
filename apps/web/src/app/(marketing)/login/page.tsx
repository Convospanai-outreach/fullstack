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
                                <p className="mt-1 text-sm text-slate-400">Don&apos;t have an account? <Link href="/signup" className="font-medium text-violet-400 hover:text-violet-300">Sign up free</Link></p>
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

                                {/* Divider */}
                                <div className="relative my-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/8" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-[#0f172a] px-3 text-xs text-slate-500">Or continue with</span>
                                    </div>
                                </div>

                                {/* OAuth */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        id="login-google"
                                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                        Google
                                    </button>
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
