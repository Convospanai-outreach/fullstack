"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: credentials.email,
                password: credentials.password,
            });

            if (result?.error) {
                toast.error("Invalid credentials");
            } else {
                toast.success("Welcome back!");
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        signIn("google", { callbackUrl: "/dashboard" });
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            {/* Decorative Background */}
            <div className="fixed inset-0 pointer-events-none opacity-30">
                <div className="absolute top-[20%] right-[30%] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[20%] left-[20%] w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-[fadeSlideUp_0.5s_ease-out]">
                <SectionHeader title="Welcome Back" subtitle="Sign in to your account" />

                <GlassCard>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={credentials.email}
                                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 placeholder:text-gray-500"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-300">Password</label>
                                <Link href="/contact" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Need help? Contact us</Link>
                            </div>
                            <input
                                type="password"
                                name="password"
                                required
                                value={credentials.password}
                                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 placeholder:text-gray-500"
                                placeholder="••••••••"
                            />
                        </div>

                        <Button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 rounded-xl py-3 text-base font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 gap-2"
                        >
                            {loading ? "Signing in..." : "Sign In"}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </Button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-3 bg-[#0f172a] text-gray-500 text-xs uppercase tracking-wider font-medium">Or continue with</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="bg-white/5 border border-white/10 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                <span className="text-white text-sm font-medium">Google</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/login/sso")}
                                className="bg-white/5 border border-white/10 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                            >
                                <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                                    <div className="w-2 h-2 border-t border-l border-white"></div>
                                </div>
                                <span className="text-white text-sm font-medium">Enterprise SSO</span>
                            </button>
                        </div>
                    </form>

                    {/* Trust Badge */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
                        <span>256-bit encryption · SOC2 compliant</span>
                    </div>

                    <p className="mt-4 text-center text-gray-400">
                        Don't have an account?{" "}
                        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign up</Link>
                    </p>
                </GlassCard>
            </div>
        </main>
    );
}

