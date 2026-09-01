"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getBrowserApiBase } from "@/lib/api/browserBase";

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

            const res = await fetch(`${getBrowserApiBase()}/auth/sso/check?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
                return;
            }

            if (!data.teamId || data.provider !== "OIDC") {
                toast.error("SSO is not configured for this domain. Please use password login.");
                return;
            }

            // NextAuth's providers array is empty at boot (per-team OIDC config is
            // resolved dynamically by the [...nextauth] route handler), so the
            // client-side signIn() helper's provider registry check can't be used -
            // this replicates its POST/CSRF flow by hand.
            const csrfRes = await fetch("/api/auth/csrf");
            const { csrfToken } = await csrfRes.json();

            const body = new URLSearchParams({ csrfToken, callbackUrl: "/dashboard", json: "true" });
            const signinRes = await fetch(
                `/api/auth/signin/oidc?teamId=${encodeURIComponent(data.teamId)}&login_hint=${encodeURIComponent(email)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: body.toString(),
                }
            );
            const signinData = await signinRes.json();

            if (signinData.url) {
                window.location.href = signinData.url;
            } else {
                toast.error("Could not start SSO sign-in. Please try again.");
            }
        } catch (error) {
            toast.error("SSO check failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
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
        </div>
    );
}
