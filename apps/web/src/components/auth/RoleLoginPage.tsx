"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/LogoMark";

interface RoleLoginPageProps {
    title: string;
    subtitle: string;
    emailLabel: string;
    callbackUrl: string;
    accent: "cyan" | "violet";
}

export function RoleLoginPage({ title, subtitle, emailLabel, callbackUrl, accent }: RoleLoginPageProps) {
    const router = useRouter();
    const gradient = accent === "cyan" ? "from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500" : "from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500";

    const handleLogin = () => {
        router.push(`/login?redirect_url=${encodeURIComponent(callbackUrl)}`);
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
                            <LogoMark className="h-8 w-8" />
                            CraftMyFunnel
                        </Link>
                        <h1 className="text-3xl font-bold text-white">{title}</h1>
                        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">{emailLabel}</label>
                            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                Sign in with Clerk using your approved workspace email.
                            </p>
                        </div>

                        <Button type="button" onClick={handleLogin} className={`w-full gap-2 rounded-xl border-0 bg-gradient-to-r ${gradient} py-3 text-base font-semibold`}>
                            Continue to secure sign in
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Secure workspace access</span>
                    </div>
                </GlassCard>
            </div>
        </main>
    );
}
