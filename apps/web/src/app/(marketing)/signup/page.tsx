"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
    if (!password) return { level: 0, label: "", color: "bg-gray-700" };
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

const setupSteps = [
    "Create your workspace",
    "Connect sending",
    "Review before launch",
];

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });
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
            let data: any = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = {};
                }
            }

            if (!response.ok) {
                throw new Error(data.error || "Unable to create workspace right now.");
            }

            toast.success("Account created. Signing you in...");

            const loginResult = await signIn("credentials", {
                redirect: false,
                email: formData.email,
                password: formData.password,
            });

            if (loginResult?.error) {
                toast.error("Account created, but automatic sign-in failed. Please sign in manually.");
                router.push("/login");
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error: any) {
            const message = error instanceof Error ? error.message : "Unable to create workspace.";
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen p-4">
            <div className="fixed inset-0 pointer-events-none opacity-30">
                <div className="absolute left-[24%] top-[18%] h-[420px] w-[420px] rounded-full bg-cyan-600/15 blur-[140px]" />
                <div className="absolute bottom-[16%] right-[18%] h-[320px] w-[320px] rounded-full bg-blue-700/15 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center py-10">
                <div className="grid w-full gap-8 lg:grid-cols-[1.05fr,0.95fr]">
                    <div className="space-y-6 self-center">
                        <SectionHeader
                            title="Create your workspace"
                            subtitle="Set up sending, voice, leads, and approvals in one place."
                        />

                        <p className="max-w-xl text-base text-gray-400">
                            You will start with the core steps so your workspace is ready for review.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {setupSteps.map((step, index) => (
                                <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Step {index + 1}</p>
                                    <p className="mt-2 text-sm font-medium text-white">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="animate-[fadeSlideUp_0.5s_ease-out]">
                        <GlassCard>
                            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Yes, setup continues after signup
                                </div>
                                <p className="mt-2 text-emerald-50/90">
                                    Connect email, define writing style, import leads, and review launch readiness.
                                </p>
                            </div>

                            <form onSubmit={handleSignup} className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-300">Full name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-300 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Avery Chen"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-300">Work email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-300 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-300">Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={formData.password}
                                        onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-300 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Create a secure password"
                                    />
                                    {formData.password && (
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((index) => (
                                                    <div
                                                        key={index}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${index <= passwordStrength.level ? passwordStrength.color : "bg-white/10"}`}
                                                    />
                                                ))}
                                            </div>
                                            <p className={`text-xs font-medium ${
                                                passwordStrength.level <= 1 ? "text-red-400" :
                                                passwordStrength.level <= 2 ? "text-orange-400" :
                                                passwordStrength.level <= 3 ? "text-yellow-400" :
                                                "text-emerald-400"
                                            }`}>
                                                Password strength: {passwordStrength.label}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-base font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/30"
                                >
                                    {loading ? "Creating workspace..." : "Create workspace"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </Button>
                                {errorMessage && (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
                                        {errorMessage}
                                    </div>
                                )}

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="bg-[#0f172a] px-3 text-xs font-medium uppercase tracking-wider text-gray-500">Or continue with</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span className="text-sm font-medium text-white">Continue with Google</span>
                                </button>
                            </form>

                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                                <span>14-day trial, no credit card required, with review controls before send</span>
                            </div>

                            <p className="mt-4 text-center text-gray-400">
                                Already have an account?{" "}
                                <Link href="/login" className="font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                                    Sign in
                                </Link>
                            </p>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </main>
    );
}
