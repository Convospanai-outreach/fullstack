"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/brand/LogoMark";

function handleGoogleSignup(inviteToken: string | undefined) {
    // Google's OAuth redirect can't carry arbitrary metadata, so the invite
    // token is relayed via a short-lived cookie the signIn callback reads
    // server-side (apps/web/src/lib/auth.ts). Only relevant when following a
    // real invite link - signup itself is open without one.
    if (inviteToken) {
        document.cookie = `cmf-invite-token=${encodeURIComponent(inviteToken)}; path=/; max-age=600; samesite=lax`;
    }
    signIn("google", { callbackUrl: "/onboarding" });
}

export default function SignupPage() {
    const searchParams = useSearchParams();
    const inviteToken = searchParams.get("token") || undefined;

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </Link>
                <button
                    type="button"
                    onClick={() => handleGoogleSignup(inviteToken)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                >
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
