"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";

export default function SignupPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel
                </Link>
                <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    Signup is invite-only. Use the approved workspace email or the invite link emailed by Clerk.
                </div>
                <SignUp
                    routing="path"
                    path="/signup"
                    signInUrl="/login"
                    fallbackRedirectUrl="/dashboard"
                    forceRedirectUrl="/dashboard"
                />
            </div>
        </main>
    );
}
