"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";

const marketingLinks = [
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
    { href: "/about", label: "About" },
];

export function NavBar() {
    const [open, setOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <Link href="/" className="group flex items-center gap-2">
                    <LogoMark priority className="h-8 w-8" />
                    <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-lg font-bold text-transparent">
                        CraftMyFunnel
                    </span>
                </Link>

                <div className="hidden items-center gap-7 md:flex">
                    {marketingLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="h-5 w-px bg-white/15" />
                    <Link
                        href="/login"
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/signup"
                        className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
                    >
                        Get Started
                    </Link>
                </div>

                <button
                    type="button"
                    className="rounded-md p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
                    aria-label="Open menu"
                    onClick={() => setOpen((prev) => !prev)}
                >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
            </div>

            {open && (
                <div className="border-t border-white/10 bg-slate-950/95 px-6 py-4 md:hidden">
                    <div className="flex flex-col gap-4">
                        {marketingLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Link href="/login" className="text-sm font-medium text-slate-100" onClick={() => setOpen(false)}>
                            Sign In
                        </Link>
                        <Link
                            href="/signup"
                            className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-center text-sm font-semibold text-white"
                            onClick={() => setOpen(false)}
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
