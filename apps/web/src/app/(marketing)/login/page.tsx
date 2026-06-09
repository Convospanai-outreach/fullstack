"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-white">C</span>
                    CraftMyFunnel
                </Link>
                <SignIn
                    routing="path"
                    path="/login"
                    signUpUrl="/signup"
                    fallbackRedirectUrl="/dashboard"
                    forceRedirectUrl="/dashboard"
                />
            </div>
        </main>
    );
}
