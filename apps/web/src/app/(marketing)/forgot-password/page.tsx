"use client";

import Link from "next/link";
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen p-4">
            <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center py-10">
                <div className="grid w-full gap-8 lg:grid-cols-[1fr,0.95fr]">
                    <div className="space-y-6 self-center">
                        <SectionHeader title="Reset password" subtitle="We will email a recovery link so you can get back to the workspace." />
                        <p className="max-w-xl text-base text-gray-400">
                            Use the work email tied to your account. After reset, you can return to setup, dashboard approvals, and campaign controls without losing progress.
                        </p>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-gray-300">
                            <div className="flex items-center gap-2 font-medium text-white">
                                <MailCheck className="h-4 w-4 text-cyan-300" />
                                What happens next
                            </div>
                            <p className="mt-3">1. Enter your email.</p>
                            <p className="mt-1">2. Open the recovery link we send.</p>
                            <p className="mt-1">3. Set a new password and return to sign in.</p>
                        </div>
                    </div>

                    <GlassCard>
                        <form className="space-y-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-300">Work email</label>
                                <input
                                    type="email"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition focus:border-cyan-500 focus:outline-none"
                                    placeholder="you@company.com"
                                />
                            </div>

                            <Button className="w-full border-0 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
                                Send recovery link
                            </Button>
                        </form>

                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                            <span>Recovery is sent only to the email address on the account</span>
                        </div>

                        <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-cyan-400 transition hover:text-cyan-300">
                            <ArrowLeft className="h-4 w-4" />
                            Back to sign in
                        </Link>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
