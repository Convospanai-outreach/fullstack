"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SsoLoginPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSsoCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const domain = email.split("@")[1];
            if (!domain) {
                toast.error("Please enter a valid email");
                return;
            }

            // In a real implementation:
            // 1. Fetch from /api/auth/sso/check?domain=...
            // 2. If configured, redirect to IDP
            // 3. For now, we will mock the redirect or show "Not Configured"

            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/auth/sso/check?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                toast.error("SSO is not configured for this domain. Please use password login.");
            }
        } catch (error) {
            toast.error("SSO check failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <SectionHeader
                    title="Enterprise Sign-In"
                    subtitle="Log in using your corporate credentials"
                />

                <GlassCard className="p-8">
                    <form onSubmit={handleSsoCheck} className="space-y-6">
                        <div className="flex justify-center mb-6">
                            <div className="bg-orange-500/10 p-4 rounded-full border border-orange-500/20">
                                <Shield className="w-8 h-8 text-orange-400" />
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-white font-bold">Sign in with SSO</h3>
                            <p className="text-xs text-gray-400 px-4">Enter your work email address and we'll redirect you to your identity provider.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Work Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                                placeholder="name@company.com"
                            />
                        </div>

                        <Button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-500 border-0"
                        >
                            {loading ? "Checking SSO..." : "Continue with SSO"}
                        </Button>

                        <Link
                            href="/login"
                            className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-white transition-all pt-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to regular login
                        </Link>
                    </form>
                </GlassCard>
            </div>
        </main>
    );
}
