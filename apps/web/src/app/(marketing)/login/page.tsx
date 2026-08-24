"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogoMark } from "@/components/brand/LogoMark";

function waitFor<T>(predicate: () => T | undefined | null, timeoutMs = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const check = () => {
            const value = predicate();
            if (value) {
                resolve(value);
                return;
            }
            if (Date.now() - startedAt > timeoutMs) {
                reject(new Error("Clerk did not initialize in time"));
                return;
            }
            window.setTimeout(check, 100);
        };
        check();
    });
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if ([...document.scripts].some((script) => script.src === src)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect_url") || params.get("callbackUrl") || "/dashboard";
}

function LoginForm() {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mountNode = mountRef.current;
        if (!mountNode || mountNode.getAttribute("data-clerk-mounted") === "true") return;
        mountNode.setAttribute("data-clerk-mounted", "true");

        const setUnavailable = () => {
            mountNode.textContent = "Sign in is unavailable right now. Please refresh and try again.";
            mountNode.className = "text-center text-sm text-rose-300";
        };

        (async () => {
            try {
                const clerk = await waitFor(() => (window as any).Clerk);
                const uiUrl =
                    document.querySelector('link[href*="/npm/@clerk/ui@"]')?.getAttribute("href") ||
                    "https://clerk.craftmyfunnel.live/npm/@clerk/ui@1/dist/ui.browser.js";

                await loadScript(uiUrl);
                const ClerkUI = await waitFor(() => (window as any).__internal_ClerkUICtor);
                await clerk.load({ ui: { ClerkUI } });

                clerk.mountSignIn(mountNode, {
                    routing: "hash",
                    signUpUrl: "/signup",
                    fallbackRedirectUrl: getRedirectUrl(),
                    forceRedirectUrl: getRedirectUrl(),
                });
            } catch {
                setUnavailable();
            }
        })();
    }, []);

    return <div id="clerk-sign-in-root" ref={mountRef} />;
}

function InviteRequiredNotice() {
    const clerk = useClerk();
    const [signingOut, setSigningOut] = useState(false);

    const handleSignOut = async () => {
        setSigningOut(true);
        try {
            await clerk.signOut({ redirectUrl: "/login" });
        } catch {
            setSigningOut(false);
        }
    };

    return (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-center text-sm text-amber-100">
            <p>
                This account isn&apos;t linked to an approved workspace yet. If you were invited,
                make sure you&apos;re signed in with the exact email your invite was sent to.
                Otherwise, request access and wait for approval before signing in.
            </p>
            <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-60"
            >
                {signingOut ? "Signing out..." : "Sign out and try a different account"}
            </button>
        </div>
    );
}

export default function LoginPage() {
    const searchParams = useSearchParams();
    const inviteRequired = searchParams.get("invite") === "required";

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </Link>
                {inviteRequired ? <InviteRequiredNotice /> : <LoginForm />}
            </div>
        </div>
    );
}
