"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("No verification token provided");
            return;
        }

        verifyEmail(token);
    }, [token]);

    const verifyEmail = async (token: string) => {
        try {
            const response = await fetch(`/api/auth/verify-email?token=${token}`);
            const data = await response.json();

            if (response.ok && data.success) {
                setStatus("success");
                setMessage("Email verified successfully!");

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    router.push("/dashboard");
                }, 2000);
            } else {
                setStatus("error");
                setMessage(data.error || "Verification failed");
            }
        } catch (error) {
            setStatus("error");
            setMessage("Failed to verify email. Please try again.");
        }
    };

    const handleResend = async () => {
        try {
            const response = await fetch("/api/auth/resend-verification", {
                method: "POST"
            });

            if (response.ok) {
                toast.success("Verification email sent! Check your inbox.");
            } else {
                toast.error("Failed to send verification email");
            }
        } catch (error) {
            toast.error("An error occurred");
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
            <GlassCard className="w-full max-w-md p-8">
                <div className="text-center">
                    {status === "loading" && (
                        <>
                            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-400 animate-spin" />
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Verifying your email...
                            </h1>
                            <p className="text-gray-400">Please wait a moment</p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
                            <h1 className="text-2xl font-bold text-white mb-2">
                                {message}
                            </h1>
                            <p className="text-gray-400 mb-6">
                                Redirecting you to the dashboard...
                            </p>
                            <Loader2 className="w-6 h-6 mx-auto text-blue-400 animate-spin" />
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Verification Failed
                            </h1>
                            <p className="text-gray-400 mb-6">{message}</p>

                            <div className="space-y-3">
                                <Button
                                    onClick={handleResend}
                                    variant="primary"
                                    className="w-full"
                                >
                                    Resend Verification Email
                                </Button>
                                <Button
                                    onClick={() => router.push("/login")}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Go to Login
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </GlassCard>
        </main>
    );
}
