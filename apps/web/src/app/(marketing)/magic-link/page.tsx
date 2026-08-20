"use client";


import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function MagicLinkPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <div className="mb-8 flex justify-center">
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                        <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>

                <SectionHeader title="Check your email" subtitle="We sent you a magic link to sign in" />

                <GlassCard>
                    <p className="text-gray-300 mb-6">
                        Click the link sent to <span className="text-white font-medium">user@example.com</span> to sign in instantly.
                    </p>

                    <div className="space-y-4">
                        <Button className="w-full" onClick={() => window.location.href = '/login'}>
                            Back to Login
                        </Button>

                        <p className="text-sm text-gray-400">
                            Didn't receive the email? <button className="text-blue-400 hover:text-blue-300">Resend</button>
                        </p>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
