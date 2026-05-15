"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface RoleLoginPageProps {
    title: string;
    subtitle: string;
    emailLabel: string;
    callbackUrl: string;
    accent: "cyan" | "violet";
}

export function RoleLoginPage({ title, subtitle, emailLabel, callbackUrl, accent }: RoleLoginPageProps) {
    const router = useRouter();
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const gradient = accent === "cyan" ? "from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500" : "from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500";

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorMessage(null);
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: credentials.email,
                password: credentials.password,
                callbackUrl,
            });

            if (result?.error) {
                setErrorMessage("Invalid email or password. Please try again.");
            } else {
                toast.success("Welcome back!");
                window.location.assign(callbackUrl);
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
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-600/10 blur-[120px]" />
                <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center py-10">
                <GlassCard>
                    <div className="mb-7 text-center">
                        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-lg font-black text-white">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xs font-black text-white`}>
                                CS
                            </div>
                            ConvoSpan
                        </Link>
                        <h1 className="text-3xl font-bold text-white">{title}</h1>
                        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
                    </div>

                    <form method="post" onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">{emailLabel}</label>
                            <input
                                type="email"
                                name="email"
                                required
                                autoComplete="email"
                                value={credentials.email}
                                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                placeholder="you@company.com"
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="block text-sm font-medium text-slate-300">Password</label>
                                <Link href="/forgot-password" className="text-sm text-cyan-300 hover:text-cyan-200">
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                name="password"
                                required
                                autoComplete="current-password"
                                value={credentials.password}
                                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-all placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                placeholder="Password"
                            />
                        </div>

                        <Button disabled={loading} type="submit" className={`w-full gap-2 rounded-xl border-0 bg-gradient-to-r ${gradient} py-3 text-base font-semibold`}>
                            {loading ? "Signing in..." : "Sign in"}
                            {!loading && <ArrowRight className="h-4 w-4" />}
                        </Button>

                        {errorMessage && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                                {errorMessage}
                            </div>
                        )}

                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Secure workspace access</span>
                    </div>
                </GlassCard>
            </div>
        </main>
    );
}
