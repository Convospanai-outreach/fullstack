"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import LinkedInSignInButton from "@/components/auth/LinkedInSignInButton";
import { postLoginPath } from "@/lib/postLoginPath";

function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect_url") || params.get("callbackUrl") || postLoginPath();
}

// Credentials sign-in navigates by hand (redirect:false, to read the error), so
// unlike NextAuth's own redirect it must refuse off-site targets itself.
function safeRedirectPath() {
    const url = getRedirectUrl();
    // Browsers read "/\host" like "//host", so backslashes are refused too.
    return url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") ? url : postLoginPath();
}

const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none";

const AUTH_ERRORS: Record<string, string> = {
    EMAIL_NOT_VERIFIED: "Please verify your email first. Check your inbox for the link.",
    SSO_REQUIRED: "Your organization requires single sign-on.",
    ACCOUNT_SUSPENDED: "This account has been suspended. Contact support if you think this is a mistake.",
    RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
};

function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [code, setCode] = useState("");
    const [info, setInfo] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        setCode("");
        setInfo("");
        try {
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.ok && !result.error) {
                router.push(safeRedirectPath());
                router.refresh();
                return;
            }
            const errorCode = result?.error ?? "";
            setCode(errorCode);
            setError(AUTH_ERRORS[errorCode] ?? "Incorrect email or password.");
        } finally {
            setSubmitting(false);
        }
    }

    async function resend() {
        await fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        setInfo("If that account is waiting on verification, we've sent a new link.");
    }

    return (
        <>
            <form onSubmit={submit} className="space-y-3">
                <input required aria-label="Email" placeholder="Email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                <input required aria-label="Password" placeholder="Password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                {code === "EMAIL_NOT_VERIFIED" && (
                    <button type="button" onClick={resend} className="text-sm text-white underline">
                        Resend verification email
                    </button>
                )}
                {info && <p className="text-sm text-slate-300">{info}</p>}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
                >
                    {submitting ? "Signing in..." : "Sign in"}
                </button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
            </div>
            <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: getRedirectUrl() })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
                Continue with Google
            </button>
            <LinkedInSignInButton onClick={() => signIn("linkedin", { callbackUrl: getRedirectUrl() })} />
            <p className="mt-6 text-center text-sm text-slate-400">
                New here? <Link href="/signup" className="text-white underline">Create an account</Link>
            </p>
        </>
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

// Why a LinkedIn sign-in was turned away (set by linkedInSignIn in @/lib/linkedinLogin).
const LINKEDIN_NOTICES: Record<string, string> = {
    "linkedin-not-connected":
        "That LinkedIn profile isn't connected to a CraftMyFunnel account yet. Sign in below the way you usually do, then open Settings > General and choose Connect LinkedIn.",
    "linkedin-no-email":
        "LinkedIn didn't share a verified email address, so we couldn't create an account from it. Create an account with your email or Google instead.",
};

function SuspendedNotice() {
    return (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-center text-sm text-amber-100">
            <p>This account has been suspended. Contact support if you think this is a mistake.</p>
        </div>
    );
}

export default function LoginPage() {
    const searchParams = useSearchParams();
    const ssoRequired = searchParams.get("error") === "sso-required";
    const suspended = searchParams.get("error") === "suspended";
    const linkedInNotice = LINKEDIN_NOTICES[searchParams.get("error") ?? ""];

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </Link>
                {linkedInNotice && (
                    <p role="alert" className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                        {linkedInNotice}
                    </p>
                )}
                {suspended ? <SuspendedNotice /> : ssoRequired ? <SsoRequiredNotice /> : <LoginForm />}
            </div>
        </div>
    );
}
