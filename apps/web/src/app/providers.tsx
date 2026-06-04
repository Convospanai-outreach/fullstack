"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type PostHogClient = {
    init: (key: string, options: Record<string, unknown>) => void;
    capture?: (event: string, properties?: Record<string, unknown>) => void;
    __loaded?: boolean;
};

declare global {
    interface Window {
        posthog?: PostHogClient;
    }
}

export function Providers({ children, session }: any) {
    const pathname = usePathname();
    const posthogKey = process.env["NEXT_PUBLIC_POSTHOG_KEY"];
    const posthogHost = process.env["NEXT_PUBLIC_POSTHOG_HOST"] || "https://app.posthog.com";

    useEffect(() => {
        if (!posthogKey || window.posthog?.__loaded) return;

        const existingScript = document.querySelector<HTMLScriptElement>("script[data-posthog]");
        if (existingScript) return;

        const queuedPosthog: PostHogClient = {
            init: (key, options) => {
                (window.posthog as unknown as { _i?: unknown[][] })._i = [
                    ...((window.posthog as unknown as { _i?: unknown[][] })._i || []),
                    [key, options]
                ];
            }
        };
        window.posthog = window.posthog || queuedPosthog;

        const script = document.createElement("script");
        script.async = true;
        script.dataset["posthog"] = "true";
        script.src = `${posthogHost.replace(/\/$/, "")}/static/array.js`;
        script.onload = () => {
            window.posthog?.init(posthogKey, {
                api_host: posthogHost,
                capture_pageview: true,
                capture_pageleave: true,
                loaded: () => {
                    if (window.posthog) window.posthog.__loaded = true;
                },
            });
        };
        document.head.appendChild(script);
    }, [posthogHost, posthogKey]);

    const sessionFreePrefixes = [
        "/", "/about", "/contact", "/pricing",
        "/login", "/signup", "/privacy", "/terms",
        "/verify-email", "/forgot-password", "/magic-link",
    ];

    const disableSessionProvider = sessionFreePrefixes.some(
        (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
    );

    if (disableSessionProvider) {
        return <>{children}</>;
    }

    return <SessionProvider session={session}>{children}</SessionProvider>;
}
