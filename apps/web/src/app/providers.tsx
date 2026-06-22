"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";

export function Providers({ children, session }: any) {
    const pathname = usePathname();

    const sessionFreePrefixes = [
        "/", "/about", "/contact", "/pricing",
        "/login", "/signup", "/privacy", "/terms",
        "/security", "/support", "/data-deletion",
        "/google-api-disclosure", "/funnel", "/help", "/faq",
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
