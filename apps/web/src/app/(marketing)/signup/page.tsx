"use client";

import { useRef, useState } from "react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/brand/LogoMark";
import LinkedInSignInButton from "@/components/auth/LinkedInSignInButton";

function handleOAuthSignup(provider: "google" | "linkedin", inviteToken: string | undefined) {
    // Google's OAuth redirect can't carry arbitrary metadata, so the invite
    // token is relayed via a short-lived cookie the signIn callback reads
    // server-side (apps/web/src/lib/auth.ts). Only relevant when following a
    // real invite link - signup itself is open without one.
    if (inviteToken) {
        document.cookie = `cmf-invite-token=${encodeURIComponent(inviteToken)}; path=/; max-age=600; samesite=lax`;
    }
    // Google gives us no phone/company, so collect them first; the page forwards
    // to /onboarding straight away if the profile is already complete.
    signIn(provider, { callbackUrl: "/complete-profile?next=%2Fonboarding" });
}

const inputClass =
    "w-full rounded-[2px] border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

type Form = { firstName: string; lastName: string; company: string; phone: string; email: string; password: string };

function SignupForm({ initialEmail }: { initialEmail: string }) {
    const [form, setForm] = useState<Form>({ firstName: "", lastName: "", company: "", phone: "", email: initialEmail, password: "" });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<{ emailSent: boolean } | null>(null);
    const [website, setWebsite] = useState(""); // honeypot: real users never see or fill it
    const [turnstileToken, setTurnstileToken] = useState("");
    const startedAt = useRef(Date.now());

    const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [key]: e.target.value });

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, website, turnstileToken, elapsedMs: Date.now() - startedAt.current }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not create your account. Please try again.");
                return;
            }
            setDone({ emailSent: data.emailSent !== false });
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="rounded-2xl border border-input bg-card p-6 text-center text-sm text-foreground">
                {done.emailSent ? (
                    <p>We sent a verification link to <strong>{form.email}</strong>. Open it to activate your account, then <Link href="/login" className="underline">sign in</Link>.</p>
                ) : (
                    <p>Your account was created, but we couldn&apos;t send the verification email. Go to <Link href="/login" className="underline">sign in</Link> and choose &ldquo;Resend verification email&rdquo;.</p>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <input required aria-label="First name" placeholder="First name" autoComplete="given-name" className={inputClass} value={form.firstName} onChange={set("firstName")} />
                <input required aria-label="Last name" placeholder="Last name" autoComplete="family-name" className={inputClass} value={form.lastName} onChange={set("lastName")} />
            </div>
            <input required aria-label="Company name" placeholder="Company name" autoComplete="organization" className={inputClass} value={form.company} onChange={set("company")} />
            <input required aria-label="Phone number" placeholder="Phone number" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={set("phone")} />
            <input required aria-label="Work email" placeholder="Work email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={set("email")} />
            <input required aria-label="Password" placeholder="Password (min 10 characters)" type="password" minLength={10} maxLength={72} autoComplete="new-password" className={inputClass} value={form.password} onChange={set("password")} />
            <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />
            <TurnstileWidget onToken={setTurnstileToken} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-none px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 bg-primary hover:bg-primary/90"
            >
                {submitting ? "Creating account..." : "Create account"}
            </button>
        </form>
    );
}

export default function SignupPage() {
    const searchParams = useSearchParams();
    const inviteToken = searchParams.get("token") || undefined;
    // The homepage sign-up box sends the visitor here with their email; just a convenience, the field stays editable.
    const initialEmail = (searchParams.get("email") ?? "").trim().slice(0, 254);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-foreground">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </Link>
                <SignupForm initialEmail={initialEmail} />
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-accent" />
                    or
                    <span className="h-px flex-1 bg-accent" />
                </div>
                <button
                    type="button"
                    onClick={() => handleOAuthSignup("google", inviteToken)}
                    className="flex w-full items-center justify-center gap-2 rounded-none bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent"
                >
                    Continue with Google
                </button>
                <LinkedInSignInButton onClick={() => handleOAuthSignup("linkedin", inviteToken)} />
                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Already have an account? <Link href="/login" className="text-foreground underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
