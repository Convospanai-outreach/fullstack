"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Star, Zap } from "lucide-react";
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
    { stat: "2,000+", label: "teams onboarded" },
    { stat: "3.2×", label: "avg reply rate lift" },
    { stat: "< 1 hr", label: "setup time" },
];

const guaranteePoints = [
    "14-day free trial — no credit card",
    "Cancel anytime, zero lock-in",
    "Human support on every plan",
    "Data you own, exports included",
];

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

    const handleSignup = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorMessage(null);
        setLoading(true);

        try {
            const apiBase = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";
            const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
            const response = await fetch(`${base}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const raw = await response.text();
            let data: Record<string, unknown> = {};
            if (raw) {
                try { data = JSON.parse(raw); } catch { data = {}; }
            }

            if (!response.ok) {
                throw new Error((data.error as string) || "Unable to create workspace right now.");
            }

            toast.success("Workspace created — signing you in...");

            const loginResult = await signIn("credentials", {
                redirect: false,
                email: formData.email,
                password: formData.password,
            });

            if (loginResult?.error) {
                toast.error("Account created but auto sign-in failed. Please sign in manually.");
                router.push("/login");
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unable to create workspace.";
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden p-4">
            {/* Background */}
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/3 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[130px]" />
                <div className="absolute right-1/4 bottom-1/3 h-[400px] w-[400px] rounded-full bg-cyan-600/6 blur-[100px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center py-10">
                <div className="grid w-full gap-12 lg:grid-cols-[1.1fr,0.9fr]">

                    {/* ── LEFT: Trust & Value ── */}
                    <div className="hidden space-y-8 self-center lg:block">
                        <div>
                            <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white shadow-lg shadow-violet-500/25">CS</div>
                                ConvoSpan
                            </Link>
                        </div>

                        <div>
                            <h1 className="text-4xl font-black leading-tight text-white">
                                Your AI outreach team.{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                                    Ready in under an hour.
                                </span>
                            </h1>
                            <p className="mt-4 text-lg text-slate-400">
                                No training call. No 6-week setup. Just connect → train → review → launch.
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            {socialProof.map((s) => (
                                <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
                                    <p className="text-2xl font-black text-white">{s.stat}</p>
                                    <p className="mt-1 text-xs text-slate-400">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Guarantees */}
                        <div className="space-y-3">
                            {guaranteePoints.map((g) => (
                                <div key={g} className="flex items-center gap-3 text-slate-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                                    <span className="text-sm">{g}</span>
                                </div>
                            ))}
                        </div>

                        {/* Testimonial */}
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                            <div className="flex gap-1 mb-3">
                                {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                            </div>
                            <p className="text-sm leading-7 text-slate-300 italic">
                                &ldquo;We replaced Outreach AND Salesloft with ConvoSpan. Saved $2K/month and got better results.&rdquo;
                            </p>
                            <p className="mt-3 text-xs text-slate-500">— Marcus W., VP Sales @ Growthly</p>
                        </div>
                    </div>

                    {/* ── RIGHT: Form ── */}
                    <div className="animate-[fadeSlideUp_0.5s_ease-out]">
                        <GlassCard>
                            {/* Mobile brand */}
                            <div className="mb-6 flex justify-center lg:hidden">
                                <Link href="/" className="inline-flex items-center gap-2 text-lg font-black text-white">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">CS</div>
                                    ConvoSpan
                                </Link>
                            </div>

                            {/* Value banner */}
                            <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
                                    <Zap className="h-4 w-4 text-violet-400" />
                                    Free 14-day trial — no credit card required
                                </div>
                                <p className="mt-1 text-xs text-violet-200/70">
                                    Your workspace is ready the moment you sign up. Start your first campaign today.
                                </p>
                            </div>

                            <h2 className="text-2xl font-bold text-white">Create your workspace</h2>
                            <p className="mt-1 text-sm text-slate-400">Already have an account? <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300">Sign in</Link></p>

                            <form onSubmit={handleSignup} className="mt-6 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Full name</label>
                                    <input
                                        type="text"
                                        id="signup-name"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
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
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                                    <input
                                        type="password"
                                        id="signup-password"
                                        required
                                        minLength={6}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="Create a strong password"
                                    />
                                    {formData.password && (
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength.level ? passwordStrength.color : "bg-white/10"}`}
                                                    />
                                                ))}
                                            </div>
                                            <p className={`text-xs font-medium ${
                                                passwordStrength.level <= 1 ? "text-red-400" :
                                                passwordStrength.level <= 2 ? "text-orange-400" :
                                                passwordStrength.level <= 3 ? "text-yellow-400" : "text-emerald-400"
                                            }`}>
                                                {passwordStrength.label} password
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    disabled={loading}
                                    type="submit"
                                    id="signup-submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-base font-semibold shadow-lg shadow-violet-500/20 transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/30 hover:-translate-y-0.5 disabled:opacity-60"
                                >
                                    {loading ? "Creating workspace..." : "Create free workspace"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </Button>

                                {errorMessage && (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                                        {errorMessage}
                                    </div>
                                )}

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/8" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-[#0f172a] px-3 text-xs text-slate-500">Or sign up with</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    id="signup-google"
                                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continue with Google
                                </button>

                                <p className="text-center text-xs text-slate-500">
                                    By signing up you agree to our{" "}
                                    <Link href="/terms" className="text-slate-400 underline hover:text-slate-300">Terms</Link>
                                    {" "}and{" "}
                                    <Link href="/privacy" className="text-slate-400 underline hover:text-slate-300">Privacy Policy</Link>.
                                </p>
                            </form>

                            {/* Trust line */}
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> SOC 2 Compliant</span>
                                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-500" /> GDPR Ready</span>
                                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No spam ever</span>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </main>
    );
}
