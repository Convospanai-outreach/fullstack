"use client";


import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function ForgotPasswordPage() {
    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <SectionHeader title="Reset Password" subtitle="We'll send you a recovery link" />

                <GlassCard>
                    <form className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                                placeholder="you@example.com"
                            />
                        </div>

                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
                            Send Reset Link
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-gray-400">
                        Remember your password?{" "}
                        <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Back to Login</a>
                    </p>
                </GlassCard>
            </div>
        </main>
    );
}
