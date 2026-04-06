"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";

const returnPoints = [
    "Resume setup",
    "Review approvals",
    "Manage campaigns",
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
                setErrorMessage("Invalid email or password.");
            } else {
                toast.success("Welcome back.");
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
        <main className="min-h-screen p-4">
            <div className="fixed inset-0 pointer-events-none opacity-30">
                <div className="absolute right-[28%] top-[18%] h-[380px] w-[380px] rounded-full bg-cyan-600/15 blur-[130px]" />
                <div className="absolute bottom-[16%] left-[18%] h-[320px] w-[320px] rounded-full bg-blue-700/15 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center py-10">
                <div className="grid w-full gap-8 lg:grid-cols-[1.05fr,0.95fr]">
                    <div className="space-y-6 self-center">
                        <SectionHeader
                            title="Sign in to your workspace"
                            subtitle="Pick up setup, approvals, and live campaigns in one place."
                        />

                        <p className="max-w-xl text-base text-gray-400">
                            Your workspace keeps progress, campaign state, and review steps in one place.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {returnPoints.map((item, index) => (
                                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Step {index + 1}</p>
                                    <p className="mt-2 text-sm font-medium text-white">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="animate-[fadeSlideUp_0.5s_ease-out]">
                        <GlassCard>
                            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Yes, recovery and SSO are available here
                                </div>
                                <p className="mt-2 text-blue-50/90">
                                    Use password recovery or sign in with your team’s identity provider.
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-300">Work email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        autoComplete="email"
                                        value={credentials.email}
                                        onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-300 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="you@company.com"
                                    />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className="block text-sm font-medium text-gray-300">Password</label>
                                        <Link href="/forgot-password" className="text-sm text-cyan-400 transition-colors hover:text-cyan-300">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        autoComplete="current-password"
                                        value={credentials.password}
                                        onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all duration-300 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="Enter your password"
                                    />
                                </div>

                                <Button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-base font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/30"
                                >
                                    {loading ? "Signing in..." : "Sign in"}
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

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                        <span className="text-sm font-medium text-white">Google</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/login/sso")}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                                    >
                                        <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-orange-500">
                                            <div className="h-2 w-2 border-l border-t border-white" />
                                        </div>
                                        <span className="text-sm font-medium text-white">Enterprise SSO</span>
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                                <span>Encrypted sign-in with recovery and SSO options available</span>
                            </div>

                            <p className="mt-4 text-center text-gray-400">
                                Need a workspace?{" "}
                                <Link href="/signup" className="font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                                    Create one
                                </Link>
                            </p>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </main>
    );
}
