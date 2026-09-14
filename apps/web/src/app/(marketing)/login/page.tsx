"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";

function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect_url") || params.get("callbackUrl") || "/dashboard";
}

function LoginForm() {
    return (
        <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: getRedirectUrl() })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
        >
            Continue with Google
        </button>
    );
}

function SsoRequiredNotice() {
    return (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-center text-sm text-amber-100">
            <p>
                Your workspace requires signing in through your organization&apos;s SSO provider,
                not a direct Google sign-in. Contact your workspace admin if you&apos;re unsure how
                to access that.
            </p>
            <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: getRedirectUrl() })}
                className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
                Try a different Google account
            </button>
        </div>
    );
}

export default function LoginPage() {
    const searchParams = useSearchParams();
    const ssoRequired = searchParams.get("error") === "sso-required";

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </Link>
                {ssoRequired ? <SsoRequiredNotice /> : <LoginForm />}
            </div>
        </div>
    );
}
